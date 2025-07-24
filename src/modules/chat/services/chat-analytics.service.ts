import { Injectable, Logger } from "@nestjs/common";
import { InjectModel, InjectConnection } from "@nestjs/mongoose";
import { Model, Connection } from "mongoose";
import { Chats } from "../models/chat.model";
import { ChatsDocument } from "../schemas/chat.schema";
import { ChatConversationSchema } from "../schemas/chat_conversation.schema";
import { InjectRedis } from "@nestjs-modules/ioredis";
import { Redis } from "ioredis";
import { Cron, CronExpression } from "@nestjs/schedule";

interface ChatAnalytics {
  totalChats: number;
  totalMessages: number;
  activeChats: number;
  messagesPerDay: { [date: string]: number };
  messagesPerHour: { [hour: string]: number };
  messagesByType: { [type: string]: number };
  topActiveUsers: { userId: string; messageCount: number }[];
  averageResponseTime: number;
  peakHours: string[];
}

interface UserAnalytics {
  userId: string;
  totalMessages: number;
  totalChats: number;
  averageMessagesPerDay: number;
  mostActiveHours: string[];
  responseTimeAverage: number;
  messageTypes: { [type: string]: number };
  lastActivity: Date;
}

@Injectable()
export class ChatAnalyticsService {
  private readonly logger = new Logger(ChatAnalyticsService.name);

  constructor(
    @InjectModel(Chats.name) private readonly chatModel: Model<ChatsDocument>,
    @InjectConnection() private readonly connection: Connection,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ===== ANALYTICS GERAIS DO SISTEMA =====

  async getSystemAnalytics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<ChatAnalytics> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 dias atrás
    const end = endDate || new Date();

    const [
      totalChats,
      activeChats,
      messagesStats,
      messagesByType,
      topUsers,
      responseTimeStats,
    ] = await Promise.all([
      this.getTotalChats(),
      this.getActiveChats(start, end),
      this.getMessagesStats(start, end),
      this.getMessagesByType(start, end),
      this.getTopActiveUsers(start, end),
      this.getAverageResponseTime(start, end),
    ]);

    return {
      totalChats,
      totalMessages: messagesStats.total,
      activeChats,
      messagesPerDay: messagesStats.perDay,
      messagesPerHour: messagesStats.perHour,
      messagesByType,
      topActiveUsers: topUsers,
      averageResponseTime: responseTimeStats,
      peakHours: this.calculatePeakHours(messagesStats.perHour),
    };
  }

  async getUserAnalytics(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<UserAnalytics> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const userChats = await this.chatModel.find({
      chatters: { $in: [userId] },
    });

    let totalMessages = 0;
    let messageTypes: { [type: string]: number } = {};
    let hourlyActivity: { [hour: string]: number } = {};
    let lastActivity: Date = new Date(0);

    for (const chat of userChats) {
      const messageModel = this.connection.model(
        `ChatMessage_${chat._id}`,
        ChatConversationSchema,
        `ChatMessage_${chat._id}`,
      );

      const messages = await messageModel.find({
        sender: userId,
        createdAt: { $gte: start, $lte: end },
        isDeleted: { $ne: true },
      });

      totalMessages += messages.length;

      for (const message of messages) {
        // Contar tipos de mensagem
        if (message?.createdAt) {
          const type = message.messageType || "text";
          messageTypes[type] = (messageTypes[type] || 0) + 1;

          // Atividade por hora
          const hour = message.createdAt.getHours().toString();
          hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;

          // Última atividade
          if (message.createdAt > lastActivity) {
            lastActivity = message.createdAt;
          }
        }
      }
    }

    const averageMessagesPerDay =
      totalMessages /
      Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    const mostActiveHours = Object.entries(hourlyActivity)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => hour);

    return {
      userId,
      totalMessages,
      totalChats: userChats.length,
      averageMessagesPerDay,
      mostActiveHours,
      responseTimeAverage: await this.getUserAverageResponseTime(
        userId,
        start,
        end,
      ),
      messageTypes,
      lastActivity,
    };
  }

  // ===== MÉTRICAS EM TEMPO REAL =====

  async trackMessageSent(
    chatId: string,
    userId: string,
    messageType: string,
  ): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    const hour = new Date().getHours();

    // Incrementar contadores no Redis
    await Promise.all([
      this.redis.incr(`analytics:messages:total:${today}`),
      this.redis.incr(`analytics:messages:hour:${today}:${hour}`),
      this.redis.incr(`analytics:messages:type:${messageType}:${today}`),
      this.redis.incr(`analytics:user:${userId}:messages:${today}`),
      this.redis.incr(`analytics:chat:${chatId}:messages:${today}`),
    ]);

    // Definir expiração para dados diários (30 dias)
    const expireTime = 30 * 24 * 60 * 60; // 30 dias em segundos
    await Promise.all([
      this.redis.expire(`analytics:messages:total:${today}`, expireTime),
      this.redis.expire(`analytics:messages:hour:${today}:${hour}`, expireTime),
      this.redis.expire(
        `analytics:messages:type:${messageType}:${today}`,
        expireTime,
      ),
      this.redis.expire(
        `analytics:user:${userId}:messages:${today}`,
        expireTime,
      ),
      this.redis.expire(
        `analytics:chat:${chatId}:messages:${today}`,
        expireTime,
      ),
    ]);
  }

  async trackUserOnline(userId: string): Promise<void> {
    await this.redis.setex(
      `analytics:user:${userId}:online`,
      300,
      Date.now().toString(),
    ); // 5 minutos
  }

  async getOnlineUsersCount(): Promise<number> {
    const keys = await this.redis.keys("analytics:user:*:online");
    return keys.length;
  }

  async getChatActivity(
    chatId: string,
    days: number = 7,
  ): Promise<{ [date: string]: number }> {
    const activity: { [date: string]: number } = {};

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      const count = await this.redis.get(
        `analytics:chat:${chatId}:messages:${dateStr}`,
      );
      activity[dateStr] = parseInt(count || "0", 10);
    }

    return activity;
  }

  // ===== RELATÓRIOS PERIÓDICOS =====

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailyReport(): Promise<void> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split("T")[0];

      const analytics = await this.getSystemAnalytics(yesterday, yesterday);

      // Salvar relatório no Redis
      await this.redis.setex(
        `analytics:daily:${dateStr}`,
        7 * 24 * 60 * 60, // 7 dias
        JSON.stringify(analytics),
      );

      this.logger.log(`Relatório diário gerado para ${dateStr}`);
    } catch (error) {
      this.logger.error(`Erro ao gerar relatório diário: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async generateMonthlyReport(): Promise<void> {
    try {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const monthStr = lastMonth.toISOString().substring(0, 7); // YYYY-MM

      const startOfMonth = new Date(
        lastMonth.getFullYear(),
        lastMonth.getMonth(),
        1,
      );
      const endOfMonth = new Date(
        lastMonth.getFullYear(),
        lastMonth.getMonth() + 1,
        0,
      );

      const analytics = await this.getSystemAnalytics(startOfMonth, endOfMonth);

      // Salvar relatório no Redis
      await this.redis.setex(
        `analytics:monthly:${monthStr}`,
        365 * 24 * 60 * 60, // 1 ano
        JSON.stringify(analytics),
      );

      this.logger.log(`Relatório mensal gerado para ${monthStr}`);
    } catch (error) {
      this.logger.error(`Erro ao gerar relatório mensal: ${error.message}`);
    }
  }

  // ===== MÉTODOS PRIVADOS =====

  private async getTotalChats(): Promise<number> {
    return await this.chatModel.countDocuments();
  }

  private async getActiveChats(
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    return await this.chatModel.countDocuments({
      updatedAt: { $gte: startDate, $lte: endDate },
    });
  }

  private async getMessagesStats(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    total: number;
    perDay: { [date: string]: number };
    perHour: { [hour: string]: number };
  }> {
    const chats = await this.chatModel.find();
    let total = 0;
    const perDay: { [date: string]: number } = {};
    const perHour: { [hour: string]: number } = {};

    for (const chat of chats) {
      try {
        const messageModel = this.connection.model(
          `ChatMessage_${chat._id}`,
          ChatConversationSchema,
          `ChatMessage_${chat._id}`,
        );

        const messages = await messageModel.find({
          createdAt: { $gte: startDate, $lte: endDate },
          isDeleted: { $ne: true },
        });

        total += messages.length;

        for (const message of messages) {
          if (message?.createdAt) {
            const date = message.createdAt.toISOString().split("T")[0];
            const hour = message.createdAt.getHours().toString();

            perDay[date] = (perDay[date] || 0) + 1;
            perHour[hour] = (perHour[hour] || 0) + 1;
          }
        }
      } catch (error) {
        // Chat collection might not exist
        continue;
      }
    }

    return { total, perDay, perHour };
  }

  private async getMessagesByType(
    startDate: Date,
    endDate: Date,
  ): Promise<{ [type: string]: number }> {
    const chats = await this.chatModel.find();
    const messagesByType: { [type: string]: number } = {};

    for (const chat of chats) {
      try {
        const messageModel = this.connection.model(
          `ChatMessage_${chat._id}`,
          ChatConversationSchema,
          `ChatMessage_${chat._id}`,
        );

        const messages = await messageModel.find({
          createdAt: { $gte: startDate, $lte: endDate },
          isDeleted: { $ne: true },
        });

        for (const message of messages) {
          const type = message.messageType || "text";
          messagesByType[type] = (messagesByType[type] || 0) + 1;
        }
      } catch (error) {
        continue;
      }
    }

    return messagesByType;
  }

  private async getTopActiveUsers(
    startDate: Date,
    endDate: Date,
    limit: number = 10,
  ): Promise<{ userId: string; messageCount: number }[]> {
    const chats = await this.chatModel.find();
    const userMessageCounts: { [userId: string]: number } = {};

    for (const chat of chats) {
      try {
        const messageModel = this.connection.model(
          `ChatMessage_${chat._id}`,
          ChatConversationSchema,
          `ChatMessage_${chat._id}`,
        );

        const messages = await messageModel.find({
          createdAt: { $gte: startDate, $lte: endDate },
          isDeleted: { $ne: true },
        });

        for (const message of messages) {
          const userId = message.sender.toString();
          userMessageCounts[userId] = (userMessageCounts[userId] || 0) + 1;
        }
      } catch (error) {
        continue;
      }
    }

    return Object.entries(userMessageCounts)
      .map(([userId, messageCount]) => ({ userId, messageCount }))
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, limit);
  }

  private async getAverageResponseTime(
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    // Implementar lógica para calcular tempo médio de resposta
    // Por simplicidade, retornando um valor fixo
    return 120; // 2 minutos em segundos
  }

  private async getUserAverageResponseTime(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    // Implementar lógica específica do usuário
    return 90; // 1.5 minutos em segundos
  }

  private calculatePeakHours(hourlyData: { [hour: string]: number }): string[] {
    return Object.entries(hourlyData)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => `${hour}:00`);
  }
}

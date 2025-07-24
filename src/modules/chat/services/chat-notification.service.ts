import { Injectable, Logger } from "@nestjs/common";
import { InjectModel, InjectConnection } from "@nestjs/mongoose";
import { Model, Connection } from "mongoose";
import { WebSocketService } from "@common/services/webSocket.service";
import {
  MessageNotificationEvent,
  ChatStatusEvent,
  UserStatusEvent,
  MessageReadUpdate,
  MessageDeliveryUpdate,
  TypingEvent,
  UserPresence,
} from "../interfaces/chat-notification.interface";
import { Chats } from "@chat/models/chat.model";
import { DateService } from "@common/services/date.service";
import { ChatsDocument } from "@chat/schemas/chat.schema";
import { ChatConversationDocument } from "@chat/schemas/chat_conversation.schema";

@Injectable()
export class ChatNotificationService {
  private readonly logger = new Logger(ChatNotificationService.name);
  private readonly userPresenceMap = new Map<string, UserPresence>();
  private readonly typingUsers = new Map<string, Set<string>>(); // chatId -> Set of userIds

  constructor(
    @InjectModel(Chats.name) private readonly chatModel: Model<ChatsDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly webSocketService: WebSocketService,
    private readonly dateService: DateService,
  ) {}

  // ===== MÉTODOS DE NOTIFICAÇÃO DE MENSAGENS =====

  async notifyNewMessage(
    chatId: string,
    message: ChatConversationDocument,
    recipientIds: string[],
  ): Promise<void> {
    try {
      const event: MessageNotificationEvent = {
        type: "new_message",
        chatId,
        messageId: message._id.toString(),
        senderId: message.sender.toString(),
        recipientIds,
        message,
        timestamp: this.dateService.now(),
      };

      // Atualizar contadores de mensagens não lidas
      await this.updateUnreadCounts(
        chatId,
        recipientIds,
        message.sender.toString(),
      );

      // Enviar notificação via WebSocket para usuários online
      for (const userId of recipientIds) {
        if (this.webSocketService.getUserIdByID_online(userId)) {
          this.webSocketService.sendToUser(userId, "new_message", event);

          // Marcar como entregue se o usuário estiver online
          await this.markMessageAsDelivered(
            chatId,
            message._id.toString(),
            userId,
          );
        }
      }

      // Enviar notificação push para usuários offline
      // await this.sendPushNotifications(event);

      this.logger.log(
        `Nova mensagem notificada no chat ${chatId} para ${recipientIds.length} usuários`,
      );
    } catch (error) {
      this.logger.error(`Erro ao notificar nova mensagem: ${error.message}`);
    }
  }

  async notifyMessageRead(
    chatId: string,
    messageId: string,
    userId: string,
  ): Promise<void> {
    try {
      const readUpdate: MessageReadUpdate = {
        chatId,
        messageId,
        userId,
        readAt: this.dateService.now(),
      };

      // Atualizar mensagem com informação de leitura
      await this.markMessageAsRead(chatId, messageId, userId);

      // Resetar contador de não lidas para este usuário
      await this.resetUnreadCount(chatId, userId);

      // Notificar outros usuários do chat sobre a leitura
      const chat = await this.chatModel.findById(chatId);
      if (chat) {
        const otherUsers = chat.chatters.filter(
          (id) => id.toString() !== userId,
        );
        for (const otherUserId of otherUsers) {
          if (
            this.webSocketService.getUserIdByID_online(otherUserId.toString())
          ) {
            this.webSocketService.sendToUser(
              otherUserId.toString(),
              "message_read",
              readUpdate,
            );
          }
        }
      }

      this.logger.log(`Mensagem ${messageId} marcada como lida por ${userId}`);
    } catch (error) {
      this.logger.error(`Erro ao marcar mensagem como lida: ${error.message}`);
    }
  }

  async notifyMessageDelivered(
    chatId: string,
    messageId: string,
    userId: string,
  ): Promise<void> {
    try {
      const deliveryUpdate: MessageDeliveryUpdate = {
        chatId,
        messageId,
        userId,
        deliveredAt: this.dateService.now(),
      };

      await this.markMessageAsDelivered(chatId, messageId, userId);

      // Notificar o remetente sobre a entrega
      const messageModel = this.connection.model(`ChatMessage_${chatId}`);
      const message = await messageModel.findById(messageId);

      if (
        message &&
        this.webSocketService.getUserIdByID_online(message.sender.toString())
      ) {
        this.webSocketService.sendToUser(
          message.sender.toString(),
          "message_delivered",
          deliveryUpdate,
        );
      }

      this.logger.log(
        `Mensagem ${messageId} marcada como entregue para ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Erro ao marcar mensagem como entregue: ${error.message}`,
      );
    }
  }

  // ===== MÉTODOS DE STATUS DO CHAT =====

  notifyChatStatusChange(event: ChatStatusEvent) {
    try {
      for (const userId of event.affectedUserIds) {
        if (this.webSocketService.getUserIdByID_online(userId)) {
          this.webSocketService.sendToUser(userId, "chat_status_change", event);
        }
      }

      this.logger.log(`Status do chat ${event.chatId} alterado: ${event.type}`);
    } catch (error) {
      this.logger.error(
        `Erro ao notificar mudança de status do chat: ${error.message}`,
      );
    }
  }

  // ===== MÉTODOS DE PRESENÇA DE USUÁRIO =====

  setUserOnline(userId: string, currentChatId?: string): void {
    const presence: UserPresence = {
      userId,
      status: "online",
      lastSeen: this.dateService.now(),
      currentChatId,
    };

    this.userPresenceMap.set(userId, presence);

    const event: UserStatusEvent = {
      type: "user_online",
      userId,
      chatId: currentChatId,
      timestamp: this.dateService.now(),
    };

    // Notificar contatos sobre status online
    this.notifyUserStatusChange(event);
  }

  setUserOffline(userId: string): void {
    const presence = this.userPresenceMap.get(userId);
    if (presence) {
      presence.status = "offline";
      presence.lastSeen = this.dateService.now();
      this.userPresenceMap.set(userId, presence);
    }

    const event: UserStatusEvent = {
      type: "user_offline",
      userId,
      timestamp: this.dateService.now(),
    };

    // Parar digitação se estiver digitando
    this.stopTyping(userId);

    this.notifyUserStatusChange(event);
  }

  getUserPresence(userId: string): UserPresence | undefined {
    return this.userPresenceMap.get(userId);
  }

  // ===== MÉTODOS DE DIGITAÇÃO =====

  startTyping(chatId: string, userId: string): void {
    if (!this.typingUsers.has(chatId)) {
      this.typingUsers.set(chatId, new Set());
    }

    this.typingUsers.get(chatId)!.add(userId);

    const event: TypingEvent = {
      chatId,
      userId,
      isTyping: true,
      timestamp: this.dateService.now(),
    };

    this.notifyTypingStatus(event);

    // Auto-parar digitação após 3 segundos
    setTimeout(() => {
      this.stopTyping(userId, chatId);
    }, 3000);
  }

  stopTyping(userId: string, chatId?: string): void {
    if (chatId) {
      const typingSet = this.typingUsers.get(chatId);
      if (typingSet) {
        typingSet.delete(userId);
        if (typingSet.size === 0) {
          this.typingUsers.delete(chatId);
        }
      }

      const event: TypingEvent = {
        chatId,
        userId,
        isTyping: false,
        timestamp: this.dateService.now(),
      };

      return this.notifyTypingStatus(event);
    }
    // Parar digitação em todos os chats
    for (const [currentChatId, typingSet] of this.typingUsers.entries()) {
      if (typingSet.has(userId)) {
        typingSet.delete(userId);
        if (typingSet.size === 0) {
          this.typingUsers.delete(currentChatId);
        }

        const event: TypingEvent = {
          chatId: currentChatId,
          userId,
          isTyping: false,
          timestamp: this.dateService.now(),
        };

        this.notifyTypingStatus(event);
      }
    }
  }

  // ===== MÉTODOS PRIVADOS =====

  private async updateUnreadCounts(
    chatId: string,
    recipientIds: string[],
    senderId: string,
  ): Promise<void> {
    try {
      const chat = await this.chatModel.findById(chatId);
      if (!chat) return;

      const unreadCount = chat.unreadCount || new Map();

      for (const userId of recipientIds) {
        if (userId !== senderId) {
          const currentCount = unreadCount.get(userId) || 0;
          unreadCount.set(userId, currentCount + 1);
        }
      }

      await this.chatModel.findByIdAndUpdate(chatId, { unreadCount });
    } catch (error) {
      this.logger.error(
        `Erro ao atualizar contadores não lidas: ${error.message}`,
      );
    }
  }

  private async resetUnreadCount(
    chatId: string,
    userId: string,
  ): Promise<void> {
    try {
      const chat = await this.chatModel.findById(chatId);
      if (!chat) return;

      const unreadCount = chat.unreadCount || new Map();
      unreadCount.set(userId, 0);

      await this.chatModel.findByIdAndUpdate(chatId, {
        unreadCount,
        [`lastSeenAt.${userId}`]: this.dateService.now(),
      });
    } catch (error) {
      this.logger.error(`Erro ao resetar contador não lidas: ${error.message}`);
    }
  }

  private async markMessageAsRead(
    chatId: string,
    messageId: string,
    userId: string,
  ): Promise<void> {
    try {
      const messageModel = this.connection.model(`ChatMessage_${chatId}`);
      const message = await messageModel.findById(messageId);

      if (message) {
        const readBy = message.readBy || [];
        const readAt = message.readAt || new Map();

        if (!readBy.includes(userId)) {
          readBy.push(userId);
          readAt.set(userId, this.dateService.now());

          await messageModel.findByIdAndUpdate(messageId, { readBy, readAt });
        }
      }
    } catch (error) {
      this.logger.error(`Erro ao marcar mensagem como lida: ${error.message}`);
    }
  }

  private async markMessageAsDelivered(
    chatId: string,
    messageId: string,
    userId: string,
  ): Promise<void> {
    try {
      const messageModel = this.connection.model(`ChatMessage_${chatId}`);
      const message = await messageModel.findById(messageId);

      if (message) {
        const deliveredTo = message.deliveredTo || [];
        const deliveredAt = message.deliveredAt || new Map();

        if (!deliveredTo.includes(userId)) {
          deliveredTo.push(userId);
          deliveredAt.set(userId, this.dateService.now());

          await messageModel.findByIdAndUpdate(messageId, {
            deliveredTo,
            deliveredAt,
          });
        }
      }
    } catch (error) {
      this.logger.error(
        `Erro ao marcar mensagem como entregue: ${error.message}`,
      );
    }
  }

  private async notifyUserStatusChange(event: UserStatusEvent): Promise<void> {
    // Implementar lógica para notificar contatos sobre mudança de status
    // Por exemplo, buscar chats do usuário e notificar outros participantes
  }

  private notifyTypingStatus(event: TypingEvent): void {
    // Notificar outros usuários do chat sobre status de digitação
    this.webSocketService.sendToUser(event.userId, "typing_status", event);
  }

  // private async sendPushNotifications(
  //   event: MessageNotificationEvent,
  // ): Promise<void> {
  //   // Implementar envio de notificações push
  //   // Integrar com serviços como Firebase Cloud Messaging, Apple Push Notification, etc.
  // }
}

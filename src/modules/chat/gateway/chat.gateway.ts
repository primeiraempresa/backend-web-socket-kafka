import { Chats } from "@chat/models/chat.model";
import { ChatConversation } from "@chat/models/chat_conversation.model";
import { ChatPagination } from "@chat/models/chatPagination.model";
import { ChatsDocument } from "@chat/schemas/chat.schema";
import { WebSocketService } from "@common/services/webSocket.service";
import { ChatProducerService } from "@chat/services/chat.producer.service";
import { ChatService } from "@chat/services/chat.service";
import { ChatNotificationService } from "@chat/services/chat-notification.service";
import { CommonService } from "@common/services/common.service";
import { configService } from "@config/config.service";
import { Logger } from "@nestjs/common";
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  ConnectedSocket,
} from "@nestjs/websockets";
import { UserService } from "@user/services/user.service";
import { Observable } from "rxjs";
import { Chat_T, Chat_T_WS } from "@chat/interfaces/chat-T.interface";
import {
  ChatConversationT,
  ChatConversationTwS,
} from "@chat/interfaces/chat_conversation-T.interface";
import {
  Chat_conversation_messageT,
  Chat_conversation_messageT_Ws,
} from "@chat/interfaces/chat_conversation_message-T.interface";
import { RawData, Server, WebSocket } from "ws";
import { JwtService } from "@nestjs/jwt";
import { Job, Queue } from "bull";
import { InjectQueue } from "@nestjs/bull";

@WebSocketGateway({
  transports: ["websocket"],
  cors: { origin: "*" },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly chatProducerService: ChatProducerService,
    private readonly chatNotificationService: ChatNotificationService,
    private readonly commonService: CommonService,
    private readonly webSocketService: WebSocketService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    @InjectQueue("chat") private readonly queue: Queue,
  ) {}

  private readonly logger = new Logger(ChatGateway.name);

  async handleConnection(client: WebSocket, req: Request) {
    const baseUrl = configService.get<string>("URL");
    const url = new URL(req.url, baseUrl);
    const userId = url.searchParams.get("userId") as string;
    const token = url.searchParams.get("token") as string;
    const currentChatId = url.searchParams.get("chatId") as string;

    if (!userId) {
      return client.close(1008, "param userId not found");
    }
    if (!token) {
      return client.close(1008, "param token not found");
    }

    try {
      const payload = this.jwtService.verify(token);
      if (!payload) {
        return client.close(1008, "Unauthorized");
      }
    } catch {
      return client.close(1008, "Unauthorized");
    }

    try {
      await this.userService.getUserByID(userId);
    } catch {
      return client.close(1008, "user not found");
    }

    this.webSocketService.addClient(userId, client);
    this.webSocketService.setServer(this.server);

    // Marcar usuário como online
    this.chatNotificationService.setUserOnline(userId, currentChatId);

    // Processar jobs pendentes
    await this.processUserPendingJobs(userId);

    // Marcar mensagens como entregues para chats ativos
    await this.markMessagesAsDelivered(userId);

    client.on("message", (message: RawData) => {
      if (typeof message === "string") {
        const text = message;
        this.webSocketService.handleMessage(client, text);
      }
      if (Buffer.isBuffer(message)) {
        const text = message.toString("utf8");
        this.webSocketService.handleMessage(client, text);
      }
      if (Array.isArray(message)) {
        const text = Buffer.concat(message).toString("utf8");
        this.webSocketService.handleMessage(client, text);
      }
      if (message instanceof ArrayBuffer) {
        const text = Buffer.from(message).toString("utf8");
        this.webSocketService.handleMessage(client, text);
      }
    });

    this.logger.log(`Usuário ${userId} conectado ao WebSocket`);
  }

  handleDisconnect(client: WebSocket) {
    const userId = [...this.webSocketService.usersOnline.entries()].find(
      ([, socket]) => socket === client,
    )?.[0];

    if (userId) {
      this.webSocketService.removeClient(userId);
      this.chatNotificationService.setUserOffline(userId);
      this.logger.log(`Usuário ${userId} desconectado do WebSocket`);
    }
  }

  // ===== EVENTOS EXISTENTES (mantidos) =====

  @SubscribeMessage("chat")
  async getAllChats(
    @MessageBody() body: { userIds?: string[]; chatId?: string },
  ): Promise<{
    event: string;
    data: ChatsDocument | Error;
  }> {
    try {
      const result = await this.chatService.getChatByUsersIds(
        body?.userIds,
        body?.chatId,
      );
      return {
        event: "chat",
        data: result,
      };
    } catch (error) {
      return {
        event: "error",
        data: error?.response ?? error,
      };
    }
  }

  @SubscribeMessage("chats.user")
  async getChatsByUserId(@MessageBody() body: { userId: string }) {
    try {
      const result = await this.chatService.getChatsByUserId(body.userId);
      return {
        event: "chats.user",
        data: result,
      };
    } catch (error) {
      return {
        event: "error",
        data: error?.response ?? error,
      };
    }
  }

  @SubscribeMessage("chat.message")
  async getMessagens(
    @MessageBody() body: { chatId: string; page?: number; perPage?: number },
  ): Promise<{
    event: string;
    data: ChatPagination | Error;
  }> {
    try {
      const result = await this.chatService.getMessages(
        body.chatId,
        body?.page ? parseInt(body?.page.toString()) : 1,
        body?.perPage ? parseInt(body?.perPage.toString()) : 10,
      );
      return {
        event: "chat.message",
        data: result,
      };
    } catch (error) {
      return {
        event: "error",
        data: error?.response ?? error,
      };
    }
  }

  @SubscribeMessage("chat.message.id")
  async getMessageById(@MessageBody() body: Chat_T): Promise<{
    event: string;
    data: ChatConversation | Error;
  }> {
    try {
      const result: ChatConversation = await this.chatService.getMessageById(
        body.chatId,
        body.messageId,
      );
      return {
        event: "chat.message.id",
        data: result,
      };
    } catch (error) {
      return {
        event: "error",
        data: error?.response ?? error,
      };
    }
  }

  @SubscribeMessage("chat.create")
  createChat(
    @MessageBody() body: Chats,
    @ConnectedSocket() client: WebSocket,
  ): Observable<{ userId: string; chats: Chats }> | { error: string } {
    if (!this.commonService.validateArryByMongoIDs(body.chatters)) {
      return { error: "Invalid userIds" };
    }
    const userId = this.webSocketService.getUserIdBySocket(client) as string;
    return this.chatProducerService.sendMessage<{
      userId: string;
      chats: Chats;
    }>("chat.create", {
      userId,
      chats: body,
    });
  }

  @SubscribeMessage("chat.message.create")
  createMessage(
    @MessageBody()
    message: ChatConversationT,
    @ConnectedSocket() client: WebSocket,
  ): Observable<ChatConversationTwS> | { error: string } {
    const userId = this.webSocketService.getUserIdBySocket(client) as string;
    const { chatId, chat_conversation } = message;
    if (!this.commonService.validateMongoID(chat_conversation.sender)) {
      return { error: "Invalid chatId" };
    }
    return this.chatProducerService.sendMessage<ChatConversationTwS>(
      "chat.message.create",
      {
        userId,
        chatId,
        chat_conversation,
      },
    );
  }

  @SubscribeMessage("chat.message.update")
  async updateMessage(
    @MessageBody()
    data: Chat_conversation_messageT,
    @ConnectedSocket() client: WebSocket,
  ): Promise<
    | Observable<Chat_conversation_messageT>
    | {
        event: string;
        data: string;
      }
  > {
    const userId = this.webSocketService.getUserIdBySocket(client) as string;
    const { chatId, messageId, chat_conversation } = data;
    try {
      await this.chatService.getMessageById(chatId, messageId);
      return this.chatProducerService.sendMessage<Chat_conversation_messageT_Ws>(
        "chat.message.update",
        {
          userId,
          chatId,
          messageId,
          chat_conversation,
        },
      );
    } catch (error) {
      this.logger.error(error);
      return {
        event: "error",
        data: "Message not found",
      };
    }
  }

  @SubscribeMessage("chat.message.delete")
  deleteMessage(
    @MessageBody() data: { chatId: string; messageId: string },
    @ConnectedSocket() client: WebSocket,
  ):
    | Observable<{
        userId: string;
        chatId: string;
        messageId: string;
      }>
    | {
        error: string;
      } {
    const userId = this.webSocketService.getUserIdBySocket(client) as string;
    const { chatId, messageId } = data;
    if (
      !this.commonService.validateMongoID(chatId) ||
      !this.commonService.validateMongoID(messageId)
    ) {
      return { error: "Invalid chatId or messageId" };
    }
    return this.chatProducerService.sendMessage<Chat_T_WS>(
      "chat.message.delete",
      {
        userId,
        chatId,
        messageId,
      },
    );
  }

  @SubscribeMessage("chat.delete")
  async deleteChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: WebSocket,
  ): Promise<
    Observable<{
      userId: string;
      chatId: string;
    }>
  > {
    const { chatId } = data;
    const userId = this.webSocketService.getUserIdBySocket(client) as string;
    await this.chatService.getChatByUsersIds([], chatId);
    return this.chatProducerService.sendMessage<{
      userId: string;
      chatId: string;
    }>("chat.delete", {
      userId,
      chatId,
    });
  }

  // ===== NOVOS EVENTOS PARA NOTIFICAÇÕES =====

  @SubscribeMessage("message.mark.read")
  async markMessageAsRead(
    @MessageBody() data: { chatId: string; messageId: string },
    @ConnectedSocket() client: WebSocket,
  ): Promise<{ event: string; data: any }> {
    try {
      const userId = this.webSocketService.getUserIdBySocket(client) as string;
      const { chatId, messageId } = data;

      await this.chatNotificationService.notifyMessageRead(
        chatId,
        messageId,
        userId,
      );

      return {
        event: "message.read.success",
        data: { chatId, messageId, userId, readAt: new Date() },
      };
    } catch (error) {
      return {
        event: "error",
        data: error?.response ?? error,
      };
    }
  }

  @SubscribeMessage("chat.mark.all.read")
  async markAllMessagesAsRead(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: WebSocket,
  ): Promise<{ event: string; data: any }> {
    try {
      const userId = this.webSocketService.getUserIdBySocket(client) as string;
      const { chatId } = data;

      // Implementar lógica para marcar todas as mensagens como lidas
      await this.chatService.markAllMessagesAsRead(chatId, userId);

      return {
        event: "chat.all.read.success",
        data: { chatId, userId, readAt: new Date() },
      };
    } catch (error) {
      return {
        event: "error",
        data: error?.response ?? error,
      };
    }
  }

  @SubscribeMessage("typing.start")
  startTyping(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: WebSocket,
  ): void {
    const userId = this.webSocketService.getUserIdBySocket(client) as string;
    const { chatId } = data;

    this.chatNotificationService.startTyping(chatId, userId);
  }

  @SubscribeMessage("typing.stop")
  stopTyping(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: WebSocket,
  ): void {
    const userId = this.webSocketService.getUserIdBySocket(client) as string;
    const { chatId } = data;

    this.chatNotificationService.stopTyping(userId, chatId);
  }

  @SubscribeMessage("user.presence")
  getUserPresence(@MessageBody() data: { userId: string }): {
    event: string;
    data: any;
  } {
    const presence = this.chatNotificationService.getUserPresence(data.userId);
    return {
      event: "user.presence",
      data: presence || { userId: data.userId, status: "offline" },
    };
  }

  @SubscribeMessage("chat.unread.count")
  async getUnreadCount(
    @MessageBody() data: { userId: string },
  ): Promise<{ event: string; data: any }> {
    try {
      const unreadCounts = await this.chatService.getUnreadCounts(data.userId);
      return {
        event: "chat.unread.count",
        data: unreadCounts,
      };
    } catch (error) {
      return {
        event: "error",
        data: error?.response ?? error,
      };
    }
  }

  @SubscribeMessage("chat.mute")
  async muteChat(
    @MessageBody() data: { chatId: string; muteUntil?: Date },
    @ConnectedSocket() client: WebSocket,
  ): Promise<{ event: string; data: any }> {
    try {
      const userId = this.webSocketService.getUserIdBySocket(client) as string;
      const { chatId, muteUntil } = data;

      await this.chatService.muteChat(chatId, userId, muteUntil);

      return {
        event: "chat.mute.success",
        data: { chatId, userId, muteUntil },
      };
    } catch (error) {
      return {
        event: "error",
        data: error?.response ?? error,
      };
    }
  }

  @SubscribeMessage("chat.unmute")
  async unmuteChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: WebSocket,
  ): Promise<{ event: string; data: any }> {
    try {
      const userId = this.webSocketService.getUserIdBySocket(client) as string;
      const { chatId } = data;

      await this.chatService.unmuteChat(chatId, userId);

      return {
        event: "chat.unmute.success",
        data: { chatId, userId },
      };
    } catch (error) {
      return {
        event: "error",
        data: error?.response ?? error,
      };
    }
  }

  @SubscribeMessage("chat.archive")
  async archiveChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: WebSocket,
  ): Promise<{ event: string; data: any }> {
    try {
      const userId = this.webSocketService.getUserIdBySocket(client) as string;
      const { chatId } = data;

      await this.chatService.archiveChat(chatId, userId);

      return {
        event: "chat.archive.success",
        data: { chatId, userId },
      };
    } catch (error) {
      return {
        event: "error",
        data: error?.response ?? error,
      };
    }
  }

  @SubscribeMessage("chat.unarchive")
  async unarchiveChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: WebSocket,
  ): Promise<{ event: string; data: any }> {
    try {
      const userId = this.webSocketService.getUserIdBySocket(client) as string;
      const { chatId } = data;

      await this.chatService.unarchiveChat(chatId, userId);

      return {
        event: "chat.unarchive.success",
        data: { chatId, userId },
      };
    } catch (error) {
      return {
        event: "error",
        data: error?.response ?? error,
      };
    }
  }

  // ===== MÉTODOS PRIVADOS =====

  private async processUserPendingJobs(userId: string): Promise<void> {
    async function hasJobInQueue(
      queue: Queue,
      jobName: string,
      event: string,
      webSocketService: WebSocketService,
    ) {
      const waitingJobs: Job[] = await queue.getWaiting();
      const delayedJobs: Job[] = await queue.getDelayed();
      const activeJobs: Job[] = await queue.getActive();
      const allJobs = [...waitingJobs, ...delayedJobs, ...activeJobs];

      for (const item of allJobs) {
        if (item?.id) {
          const id = item.id.toString();
          if (id?.includes(jobName)) {
            webSocketService.sendToUser(
              userId,
              event,
              item.data.chat_conversation,
            );
            item.remove();
          }
        }
      }
    }

    await hasJobInQueue(
      this.queue,
      `chat.message.create.${userId}`,
      "chat.message.create",
      this.webSocketService,
    );
    await hasJobInQueue(
      this.queue,
      `chat.message.update.${userId}`,
      "chat.message.update",
      this.webSocketService,
    );
    await hasJobInQueue(
      this.queue,
      `chat.message.delete.${userId}`,
      "chat.message.delete",
      this.webSocketService,
    );
  }

  private async markMessagesAsDelivered(userId: string): Promise<void> {
    try {
      const userChats = await this.chatService.getChatsByUserId(userId);

      for (const chat of userChats) {
        const undeliveredMessages =
          await this.chatService.getUndeliveredMessages(
            chat._id.toString(),
            userId,
          );

        for (const message of undeliveredMessages) {
          await this.chatNotificationService.notifyMessageDelivered(
            chat._id.toString(),
            message._id.toString(),
            userId,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Erro ao marcar mensagens como entregues: ${error.message}`,
      );
    }
  }
}

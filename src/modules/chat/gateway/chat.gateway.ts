import { Chats } from "@chat/models/chat.model";
import { Chat_conversation } from "@chat/models/chat_conversation.model";
import { ChatPagination } from "@chat/models/chatPagination.model";
import { ChatDocument } from "@chat/schemas/chat.schema";
import { ChatWebSocketService } from "@chat/services/chat-webSocket.service";
import { ChatProducerService } from "@chat/services/chat.producer.service";
import { ChatService } from "@chat/services/chat.service";
import { CommonService } from "@common/services/common.service";
import { configService } from "@config/configService";
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
  Chat_conversationT,
  Chat_conversationT_WS,
} from "@chat/interfaces/chat_conversation-T.interface";
import {
  Chat_conversation_messageT,
  Chat_conversation_messageT_Ws,
} from "@chat/interfaces/chat_conversation_message-T.interface";
import { Server, WebSocket } from "ws";
@WebSocketGateway({
  path: "/chat",
  transports: ["websocket"],
  cors: { origin: "*" },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly chatProducerService_createChat: ChatProducerService<{
      userId: string;
      chats: Chats;
    }>,
    private readonly chatProducerService_createMessage: ChatProducerService<Chat_conversationT_WS>,
    private readonly chatProducerService_updateMessage: ChatProducerService<Chat_conversation_messageT_Ws>,
    private readonly chatProducerService_deleteMessage: ChatProducerService<Chat_T_WS>,
    private readonly chatProducerService_deleteChat: ChatProducerService<{
      userId: string;
      chatId: string;
    }>,
    private readonly commonService: CommonService,
    private readonly chatWebSocketService: ChatWebSocketService,
    private readonly userService: UserService,
  ) {}
  private usersOnline: Map<string, WebSocket> = new Map<string, WebSocket>();
  private logger = new Logger(ChatGateway.name);
  async handleConnection(client: WebSocket, req: Request) {
    const url = new URL(req.url, configService.get<string>("URL"));
    const userId = url.searchParams.get("userId") as string;
    if (!userId) {
      return client.close(1008, "param userId not found");
    }
    try {
      await this.userService.getUserByID(userId);
    } catch {
      return client.close(1008, "user not found");
    }

    this.chatWebSocketService.addClient(userId, client);
    this.chatWebSocketService.setServer(this.server);

    this.chatWebSocketService.broadcast("user.online", {
      userId,
      status: "online",
    });

    client.on("message", (message) => {
      this.handleMessage(client, message.toString());
    });
  }

  handleDisconnect(client: WebSocket) {
    const userId = [...this.chatWebSocketService.usersOnline.entries()].find(
      ([, socket]) => socket === client,
    )?.[0];

    if (userId) {
      this.chatWebSocketService.removeClient(userId);

      this.chatWebSocketService.broadcast("user.offline", {
        userId,
        status: "offline",
      });
    }
  }

  @SubscribeMessage("chat")
  async getAllChats(
    @MessageBody() body: { userIds?: string[]; chatId?: string },
  ): Promise<{
    event: string;
    data: ChatDocument | Error;
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
        data: error?.response || error,
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
        data: error?.response || error,
      };
    }
  }

  @SubscribeMessage("chat.message.id")
  async getMessageById(@MessageBody() body: Chat_T): Promise<{
    event: string;
    data: Chat_conversation | Error;
  }> {
    try {
      const result: Chat_conversation = await this.chatService.getMessageById(
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
        data: error?.response || error,
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
    const userId = this.chatWebSocketService.getUserIdBySocket(
      client,
    ) as string;
    return this.chatProducerService_createChat.sendMessage("chat.create", {
      userId,
      chats: body,
    });
  }

  @SubscribeMessage("chat.message.create")
  createMessage(
    @MessageBody()
    message: Chat_conversationT,
    @ConnectedSocket() client: WebSocket,
  ): Observable<Chat_conversationT_WS> | { error: string } {
    const userId = this.chatWebSocketService.getUserIdBySocket(
      client,
    ) as string;
    const { chatId, chat_conversation } = message;
    if (!this.commonService.validateMongoID(chat_conversation.sender)) {
      return { error: "Invalid chatId" };
    }
    return this.chatProducerService_createMessage.sendMessage(
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
    const userId = this.chatWebSocketService.getUserIdBySocket(
      client,
    ) as string;
    const { chatId, messageId, chat_conversation } = data;
    try {
      await this.chatService.getMessageById(chatId, messageId);
      return this.chatProducerService_updateMessage.sendMessage(
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
    const userId = this.chatWebSocketService.getUserIdBySocket(
      client,
    ) as string;
    const { chatId, messageId } = data;
    if (
      !this.commonService.validateMongoID(chatId) ||
      !this.commonService.validateMongoID(messageId)
    ) {
      return { error: "Invalid chatId or messageId" };
    }
    return this.chatProducerService_deleteMessage.sendMessage(
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
    const userId = this.chatWebSocketService.getUserIdBySocket(
      client,
    ) as string;
    await this.chatService.getChatByUsersIds([], chatId);
    return this.chatProducerService_deleteChat.sendMessage("chat.delete", {
      userId,
      chatId,
    });
  }
  private broadcast(message: any) {
    const str = JSON.stringify(message);
    this.usersOnline.forEach((client: WebSocket) => {
      if (client.readyState === client.OPEN) {
        return client.send(str);
      }
    });
  }
  private handleMessage(client: WebSocket, rawMessage: string) {
    try {
      const { event, data } = JSON.parse(rawMessage);

      switch (event) {
        case "users.online":
          client.send(
            JSON.stringify({
              event: "users.online",
              data: {
                users: Array.from(this.usersOnline.keys()),
              },
            }),
          );
          break;

        case "user.isOnline":
          const { userId } = data;
          const isOnline = this.usersOnline.has(userId);
          client.send(
            JSON.stringify({
              event: "user.isOnline",
              data: { userId, isOnline },
            }),
          );
          break;
      }
    } catch {
      client.send(
        JSON.stringify({
          event: "error",
          data: "Invalid message format",
        }),
      );
    }
  }
}

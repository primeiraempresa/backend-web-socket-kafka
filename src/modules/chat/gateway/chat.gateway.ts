import { Chat_conversation_DTO } from "@chat/dto/chat_conversation.dto";
import { Chats } from "@chat/models/chat.model";
import { Chat_conversation } from "@chat/models/chat_conversation.model";
import { ChatProducerService } from "@chat/services/chat.producer.service";
import { ChatService } from "@chat/services/chat.service";
import { CommonService } from "@common/services/common.service";
import { Logger } from "@nestjs/common";
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from "@nestjs/websockets";
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
    private readonly chatProducerService_createChat: ChatProducerService<Chats>,
    private readonly chatProducerService_createMessage: ChatProducerService<{
      chatId: string;
      chat_conversation: Chat_conversation;
    }>,
    private readonly chatProducerService_updateMessage: ChatProducerService<{
      chatId: string;
      body: Chat_conversation_DTO;
      messageId: string;
    }>,
    private readonly chatProducerService_deleteMessage: ChatProducerService<{
      chatId: string;
      messageId: string;
    }>,
    private readonly chatProducerService_deleteChat: ChatProducerService<{
      chatId: string;
    }>,
    private readonly commonService: CommonService,
  ) {}
  private usersOnline = new Map<string, WebSocket>();
  private logger = new Logger(ChatGateway.name);
  handleConnection(client: WebSocket, req: Request) {
    const url = new URL(req.url!, `http://localhost:3000`);
    const userId = url.searchParams.get("userId");

    if (!userId) {
      client.close();
      this.logger.warn(`Client disconnected for missing userId`);
      return;
    }

    this.usersOnline.set(userId, client);
    this.logger.log(`User ${userId} connected`);

    this.broadcast({
      event: "user.online",
      data: { userId, status: "online" },
    });

    client.on("message", (message) => {
      this.handleMessage(client, message.toString());
    });
  }

  handleDisconnect(client: WebSocket) {
    const userId = [...this.usersOnline.entries()].find(
      ([, socket]) => socket === client,
    )?.[0];
    console.log(userId);
    if (userId) {
      this.usersOnline.delete(userId);
      this.logger.log(`User ${userId} disconnected`);

      this.broadcast({
        event: "user.offline",
        data: { userId, status: "offline" },
      });
    }
  }
  @SubscribeMessage("chat.create")
  createChat(@MessageBody() body: Chats, @ConnectedSocket() client: WebSocket) {
    if (!this.commonService.validateArryByMongoIDs(body.chatters)) {
      return { error: "Invalid userIds" };
    }
    return this.chatProducerService_createChat.sendMessage("chat.create", body);
  }

  @SubscribeMessage("chat.message.create")
  createMessage(
    @MessageBody()
    message: {
      chatId: string;
      chat_conversation: Chat_conversation;
    },
    @ConnectedSocket() client: WebSocket,
  ) {
    const { chatId, chat_conversation } = message;
    if (!this.commonService.validateMongoID(chat_conversation.sender)) {
      return { error: "Invalid chatId" };
    }
    return this.chatProducerService_createMessage.sendMessage(
      "chat.message.create",
      {
        chatId,
        chat_conversation,
      },
    );
  }

  @SubscribeMessage("chat.message.update")
  async updateMessage(
    @MessageBody()
    data: {
      chatId: string;
      messageId: string;
      body: Chat_conversation_DTO;
    },
  ) {
    const { chatId, messageId, body } = data;
    await this.chatService.getMessageById(chatId, messageId);
    return this.chatProducerService_updateMessage.sendMessage(
      "chat.message.update",
      {
        chatId,
        messageId,
        body,
      },
    );
  }

  @SubscribeMessage("chat.message.delete")
  deleteMessage(@MessageBody() data: { chatId: string; messageId: string }) {
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
        chatId,
        messageId,
      },
    );
  }

  @SubscribeMessage("chat.delete")
  async deleteChat(@MessageBody() data: { chatId: string }) {
    const { chatId } = data;
    await this.chatService.getChatByUsersIds([], chatId);
    return this.chatProducerService_deleteChat.sendMessage("chat.delete", {
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

        case "chat.message":
          this.broadcast({
            event: "chat.message",
            data,
          });
          break;

        default:
          client.send(
            JSON.stringify({
              event: "error",
              data: "Unknown event",
            }),
          );
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

import { Chats } from "@chat/models/chat.model";
import { ChatsDocument } from "@chat/schemas/chat.schema";
import { ChatConversationDocument } from "@chat/schemas/chat_conversation.schema";
import { WebSocketService } from "@common/services/webSocket.service";
import { ChatService } from "@chat/services/chat.service";
import { Controller, Logger } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { ChatConversationTwS } from "@chat/interfaces/chat_conversation-T.interface";
import { Chat_conversation_messageT_Ws } from "@chat/interfaces/chat_conversation_message-T.interface";
import { ChatProducerService } from "@chat/services/chat.producer.service";
import { Queue } from "bull";
import { InjectQueue } from "@nestjs/bull";
import * as bcrypt from "bcryptjs";
import { DateService } from "@common/services/date.service";

@Controller()
export class ChatConsumerController {
  constructor(
    private readonly chatService: ChatService,
    private readonly webSocketService: WebSocketService,
    private readonly chatProducerService: ChatProducerService,
    @InjectQueue("chat")
    private readonly queue: Queue,
    private readonly dateService: DateService,
  ) {}
  private readonly logger: Logger = new Logger(ChatConsumerController.name);
  @MessagePattern("chat.create")
  async handleChatCreate(
    @Payload() message: { userId: string; chats: Chats },
  ): Promise<ChatsDocument> {
    try {
      const result: ChatsDocument = await this.chatService.createChat(
        message.chats.chatters,
      );
      this.webSocketService.sendToUser(message.userId, "chat.create", result);
      return result;
    } catch (error: any) {
      this.logger.error(error);
      this.webSocketService.sendToUser(
        message.userId,
        "error",
        error?.response ?? error,
      );
      return error?.response ?? error;
    }
  }
  @MessagePattern("chat.delete")
  async handleChatDelete(
    @Payload() message: { userId: string; chatId: string },
  ) {
    try {
      const result = await this.chatService.deleteChatById(message.chatId);
      this.webSocketService.sendToUser(message.userId, "chat.delete", result);
      return result;
    } catch (error: any) {
      this.logger.error(error);
      this.webSocketService.sendToUser(
        message.userId,
        "error",
        error?.response ?? error,
      );
      return error?.response ?? error;
    }
  }
  @MessagePattern("chat.message.create")
  async handleMessageCreate(
    @Payload()
    message: ChatConversationTwS,
  ): Promise<ChatConversationDocument> {
    try {
      const result = await this.chatService.addMessage(
        message.chatId,
        message.chat_conversation,
      );
      const chat: ChatsDocument = await this.chatService.getChatByUsersIds(
        [],
        message.chatId,
      );
      for (const item of chat.chatters) {
        const userOnline = this.webSocketService.getUserIdByID_online(
          item["_id"].toString(),
        );
        if (userOnline) {
          this.webSocketService.sendToUser(
            item["_id"].toString(),
            "chat.message.create",
            result,
          );
          continue;
        }
        this.chatProducerService.sendMessage<ChatConversationTwS>(
          "chat.message.create.pending",
          {
            userId: item["_id"].toString(),
            chatId: message.chatId,
            chat_conversation: result,
          },
        );
      }
      return result;
    } catch (error: any) {
      this.logger.error(error);
      this.webSocketService.sendToUser(
        message.userId,
        "error",
        error?.response ?? error,
      );
      return error?.response ?? error;
    }
  }
  @MessagePattern("chat.message.update")
  async handleMessageUpdate(
    @Payload()
    message: Chat_conversation_messageT_Ws,
  ): Promise<ChatConversationDocument> {
    try {
      const result = await this.chatService.updateMessageById(
        message.chatId,
        message.messageId,
        message.chat_conversation,
      );
      const chat: ChatsDocument = await this.chatService.getChatByUsersIds(
        [],
        message.chatId,
      );
      for (const item of chat.chatters) {
        const userOnline = this.webSocketService.getUserIdByID_online(
          item["_id"].toString(),
        );
        if (userOnline) {
          this.webSocketService.sendToUser(
            item["_id"].toString(),
            "chat.message.update",
            result,
          );
          continue;
        }
        this.chatProducerService.sendMessage<ChatConversationTwS>(
          "chat.message.update.pending",
          {
            userId: item["_id"].toString(),
            chatId: message.chatId,
            chat_conversation: result,
          },
        );
      }
      return result;
    } catch (error: any) {
      this.logger.error(error);
      this.webSocketService.sendToUser(
        message.userId,
        "error",
        error?.response ?? error,
      );
      return error?.response ?? error;
    }
  }
  @MessagePattern("chat.message.delete")
  async handleMessageDelete(
    @Payload() message: { userId: string; chatId: string; messageId: string },
  ): Promise<ChatConversationDocument> {
    try {
      const result = await this.chatService.deleteMessageById(
        message.chatId,
        message.messageId,
      );
      const chat: ChatsDocument = await this.chatService.getChatByUsersIds(
        [],
        message.chatId,
      );
      for (const item of chat.chatters) {
        const userOnline = this.webSocketService.getUserIdByID_online(
          item["_id"].toString(),
        );
        if (userOnline) {
          this.webSocketService.sendToUser(
            item["_id"].toString(),
            "chat.message.delete",
            result,
          );
          continue;
        }
        this.chatProducerService.sendMessage<ChatConversationTwS>(
          "chat.message.delete.pending",
          {
            userId: item["_id"].toString(),
            chatId: message.chatId,
            chat_conversation: result,
          },
        );
      }
      return result;
    } catch (error: any) {
      this.logger.error(error);
      this.webSocketService.sendToUser(
        message.userId,
        "error",
        error?.response ?? error,
      );
      return error?.response ?? error;
    }
  }
  @MessagePattern("chat.message.create.pending")
  async handleMessageCreatepending(@Payload() message: ChatConversationTwS) {
    const date = this.dateService.now().toISOString();
    const hash = await bcrypt.hash(date, 10);
    return await this.queue.add(`chat.message.create`, message, {
      jobId: `chat.message.create.${message.userId}-${hash}`,
    });
  }
  @MessagePattern("chat.message.update.pending")
  async handleMessageUpdatepending(@Payload() message: ChatConversationTwS) {
    const date = this.dateService.now().toISOString();
    const hash = await bcrypt.hash(date, 10);
    return await this.queue.add(`chat.message.update`, message, {
      jobId: `chat.message.update.${message.userId}-${hash}`,
    });
  }
  @MessagePattern("chat.message.delete.pending")
  async handleMessageDeletepending(@Payload() message: ChatConversationTwS) {
    const date = this.dateService.now().toISOString();
    const hash = await bcrypt.hash(date, 10);
    return await this.queue.add(`chat.message.delete`, message, {
      jobId: `chat.message.delete.${message.userId}-${hash}`,
    });
  }
}

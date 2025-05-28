import { Chat_conversation_DTO } from "@chat/dto/chat_conversation.dto";
import { Chats } from "@chat/models/chat.model";
import { Chat_conversation } from "@chat/models/chat_conversation.model";
import { ChatDocument } from "@chat/schemas/chat.schema";
import { ChatConversationDocument } from "@chat/schemas/chat_conversation.schema";
import { ChatWebSocketService } from "@chat/services/chat-webSocket.service";
import { ChatService } from "@chat/services/chat.service";
import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";

@Controller()
export class ChatConsumerController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatWebSocketService: ChatWebSocketService,
  ) {}
  @MessagePattern("chat.create")
  async handleChatCreate(
    @Payload() message: { userId: string; chats: Chats },
  ): Promise<ChatDocument> {
    try {
      const result = await this.chatService.createChat(message.chats.chatters);
      this.chatWebSocketService.sendToUser(
        message.userId,
        "chat.created",
        result,
      );
      return result;
    } catch (error) {
      this.chatWebSocketService.sendToUser(
        message.userId,
        "chat.error",
        error?.response || error,
      );
      return error?.response || error;
    }
  }
  @MessagePattern("chat.delete")
  async handleChatDelete(
    @Payload() message: { userId: string; chatId: string },
  ): Promise<ChatDocument> {
    try {
      const result = await this.chatService.deleteChatById(message.chatId);
      this.chatWebSocketService.sendToUser(
        message.userId,
        "chat.deleted",
        result,
      );
      return result;
    } catch (error) {
      this.chatWebSocketService.sendToUser(
        message.userId,
        "chat.error",
        error?.response || error,
      );
      return error?.response || error;
    }
  }
  @MessagePattern("chat.message.create")
  async handleMessageCreate(
    @Payload()
    message: {
      userId: string;
      chatId: string;
      chat_conversation: Chat_conversation;
    },
  ): Promise<ChatConversationDocument> {
    try {
      const result = await this.chatService.addMessage(
        message.chatId,
        message.chat_conversation,
      );
      this.chatWebSocketService.sendToUser(
        message.userId,
        "chat.message.created",
        result,
      );
      return result;
    } catch (error) {
      this.chatWebSocketService.sendToUser(
        message.userId,
        "chat.error",
        error?.response || error,
      );
      return error?.response || error;
    }
  }
  @MessagePattern("chat.message.update")
  async handleMessageUpdate(
    @Payload()
    message: {
      userId: string;
      chatId: string;
      messageId: string;
      chat_conversation: Chat_conversation_DTO;
    },
  ): Promise<ChatConversationDocument> {
    try {
      const result = await this.chatService.updateMessageById(
        message.chatId,
        message.messageId,
        message.chat_conversation,
      );
      this.chatWebSocketService.sendToUser(
        message.userId,
        "chat.message.updated",
        result,
      );
      return result;
    } catch (error) {
      this.chatWebSocketService.sendToUser(
        message.userId,
        "chat.error",
        error?.response || error,
      );
      return error?.response || error;
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
      this.chatWebSocketService.sendToUser(
        message.userId,
        "chat.message.deleted",
        result,
      );
      return result;
    } catch (error) {
      this.chatWebSocketService.sendToUser(
        message.userId,
        "chat.error",
        error?.response || error,
      );
      return error?.response || error;
    }
  }
}

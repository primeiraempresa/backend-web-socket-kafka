import { Chat_conversation_DTO } from "@chat/dto/chat_conversation.dto";
import { Chat_conversation } from "@chat/models/chat_conversation.model";
import { ChatDocument } from "@chat/schemas/chat.schema";
import { ChatConversationDocument } from "@chat/schemas/chat_conversation.schema";
import { ChatService } from "@chat/services/chat.service";
import { Controller } from "@nestjs/common";
import { MessagePattern } from "@nestjs/microservices";

@Controller()
export class ChatConsumerController {
  constructor(private readonly chatService: ChatService) {}
  @MessagePattern("chat.create")
  async handleChatCreate(message: {
    userIds: string[];
  }): Promise<ChatDocument> {
    console.log("Received:", message);
    console.log("Received from Kafka:", message);
    return await this.chatService.createChat(message.userIds);
  }
  @MessagePattern("chat.delete")
  async handleChatDelete(message: { id: string }): Promise<ChatDocument> {
    return await this.chatService.deleteChatById(message.id);
  }
  @MessagePattern("chat.message.create")
  async handleMessageCreate(message: {
    chatId: string;
    chat_conversation: Chat_conversation;
  }): Promise<ChatConversationDocument> {
    return await this.chatService.addMessage(
      message.chatId,
      message.chat_conversation,
    );
  }
  @MessagePattern("chat.message.update")
  async handleMessageUpdate(message: {
    chatId: string;
    message_id: string;
    body: Chat_conversation_DTO;
  }): Promise<ChatConversationDocument> {
    return await this.chatService.updateMessageById(
      message.chatId,
      message.message_id,
      message.body,
    );
  }
  @MessagePattern("chat.message.delete")
  async handleMessageDelete(message: {
    chatId: string;
    message_id: string;
  }): Promise<ChatConversationDocument> {
    return await this.chatService.deleteMessageById(
      message.chatId,
      message.message_id,
    );
  }
}

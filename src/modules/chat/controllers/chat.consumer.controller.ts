import { Chat_conversation_DTO } from "@chat/dto/chat_conversation.dto";
import { Chats } from "@chat/models/chat.model";
import { Chat_conversation } from "@chat/models/chat_conversation.model";
import { ChatDocument } from "@chat/schemas/chat.schema";
import { ChatConversationDocument } from "@chat/schemas/chat_conversation.schema";
import { ChatService } from "@chat/services/chat.service";
import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";

@Controller()
export class ChatConsumerController {
  constructor(private chatService: ChatService) {}
  @MessagePattern("chat.create")
  async handleChatCreate(@Payload() message: Chats): Promise<ChatDocument> {
    return await this.chatService.createChat(message.chatters);
  }
  @MessagePattern("chat.delete")
  async handleChatDelete(
    @Payload() message: { chatId: string },
  ): Promise<ChatDocument> {
    return await this.chatService.deleteChatById(message.chatId);
  }
  @MessagePattern("chat.message.create")
  async handleMessageCreate(
    @Payload()
    message: {
      chatId: string;
      chat_conversation: Chat_conversation;
    },
  ): Promise<ChatConversationDocument> {
    return await this.chatService.addMessage(
      message.chatId,
      message.chat_conversation,
    );
  }
  @MessagePattern("chat.message.update")
  async handleMessageUpdate(
    @Payload()
    message: {
      chatId: string;
      messageId: string;
      body: Chat_conversation_DTO;
    },
  ): Promise<ChatConversationDocument> {
    return await this.chatService.updateMessageById(
      message.chatId,
      message.messageId,
      message.body,
    );
  }
  @MessagePattern("chat.message.delete")
  async handleMessageDelete(
    @Payload() message: { chatId: string; messageId: string },
  ): Promise<ChatConversationDocument> {
    return await this.chatService.deleteMessageById(
      message.chatId,
      message.messageId,
    );
  }
}

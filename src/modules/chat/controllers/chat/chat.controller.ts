import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ChatService } from "../../services/chat.service";
import { ApiOAuth2, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { ChatConversationDocument } from "../../schemas/chat_conversation.schema";
import { ChatDocument } from "../../schemas/chat.schema";
import { Chat_conversation_DTO } from "../../dto/chat_conversation.dto";
import { ChatPagination } from "@chat/models/chatPagination.model";

@Controller("chat")
@UseGuards(AuthGuard("jwt"))
@ApiOAuth2(["read", "write"], "oauth2")
@ApiTags("Chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number for pagination",
  })
  @ApiQuery({
    name: "perPage",
    required: false,
    type: Number,
    description: "Number of items per page",
  })
  @Get(":chatId")
  async getAllChats(
    @Param("chatId") chatId: string,
    @Query("page") page?: number,
    @Query("perPage") perPage?: number,
  ): Promise<ChatPagination> {
    return await this.chatService.getMessages(
      chatId,
      page ? parseInt(page.toString()) : 1,
      perPage ? parseInt(perPage.toString()) : 10,
    );
  }

  @ApiQuery({
    name: "userIds",
    required: false,
    type: Array<String>,
    description: "array of user IDs",
  })
  @ApiQuery({
    name: "chat_id",
    required: false,
    type: String,
    description: "ID of the chat",
  })
  @Get()
  async getChatByUsersIdsOrById(
    @Query("userIds") userIds?: string[],
    @Query("chat_id") chat_id?: string,
  ): Promise<ChatDocument> {
    return await this.chatService.getChatByUsersIds(userIds, chat_id);
  }

  @Get(":chatId/messages/:messageId")
  async getMessages(
    @Param("chatId") chatId: string,
    @Param("messageId") messageId: string,
  ): Promise<ChatConversationDocument> {
    return await this.chatService.getMessageById(chatId, messageId);
  }
  @Put(":chatId/messages/:messageId")
  async updateMessage(
    @Param("chatId") chatId: string,
    @Param("messageId") messageId: string,
    @Body() body: Chat_conversation_DTO,
  ): Promise<ChatConversationDocument> {
    return await this.chatService.updateMessageById(chatId, messageId, body);
  }
  @Delete(":chatId/messages/:messageId")
  async deleteMessage(
    @Param("chatId") chatId: string,
    @Param("messageId") messageId: string,
  ): Promise<ChatConversationDocument> {
    return await this.chatService.deleteMessageById(chatId, messageId);
  }
  @Delete(":chatId")
  async deleteChat(@Param("chatId") chatId: string): Promise<ChatDocument> {
    return await this.chatService.deleteChatById(chatId);
  }
}

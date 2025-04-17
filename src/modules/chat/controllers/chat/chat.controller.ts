import {
  Controller,
  Get,
  Injectable,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ChatService } from "../../services/chat/chat.service";
import { ApiOAuth2, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { ChatConversationDocument } from "../../schemas/chat_conversation.schema";

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
  ) {
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
  ) {
    return await this.chatService.getChatByUsersIds(userIds, chat_id);
  }

  @Get(":chatId/messages/:messageId")
  async getMessages(
    @Param("chatId") chatId: string,
    @Param("messageId") messageId: string,
  ): Promise<ChatConversationDocument> {
    return await this.chatService.getMessageById(chatId, messageId);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ChatService } from "../services/chat.service";
import { ApiOAuth2, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { ChatConversationDocument } from "../schemas/chat_conversation.schema";
import { ChatsDocument } from "../schemas/chat.schema";
import { ChatConversationDTO } from "../dto/chat_conversation.dto";
import { ChatConversation } from "@chat/models/chat_conversation.model";
import { CommonService } from "@common/services/common.service";
import { Chats } from "@chat/models/chat.model";
import { IPagination } from "@common/interface/pagination.interface";

@Controller("chat")
@UseGuards(AuthGuard("jwt"))
@ApiOAuth2(["read", "write"], "oauth2")
@ApiTags("Chat")
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly commonService: CommonService,
  ) {}
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
  ): Promise<IPagination<ChatConversationDocument>> {
    return await this.chatService.getMessages(
      chatId,
      page ? parseInt(page.toString()) : 1,
      perPage ? parseInt(perPage.toString()) : 10,
    );
  }

  @ApiQuery({
    name: "userIds",
    required: false,
    type: Array<string>,
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
  ): Promise<ChatsDocument> {
    return await this.chatService.getChatByUsersIds(userIds, chat_id);
  }

  @Get(":chatId/messages/:messageId")
  async getMessages(
    @Param("chatId") chatId: string,
    @Param("messageId") messageId: string,
  ): Promise<ChatConversationDocument> {
    return await this.chatService.getMessageById(chatId, messageId);
  }
  @Get("user/:userId")
  async getChatsByUserId(@Param("userId") userId: string) {
    return await this.chatService.getChatsByUserId(userId);
  }
  @Post()
  createChat(@Body() body: Chats): Promise<ChatsDocument> {
    if (!this.commonService.validateArryByMongoIDs(body.chatters)) {
      throw new BadRequestException(["invalid userIds"]);
    }
    return this.chatService.createChat(body.chatters);
  }

  @Post("/:chatId/messages")
  createMessage(
    @Param("chatId") chatId: string,
    @Body() body: ChatConversation,
  ): Promise<ChatConversationDocument> {
    if (!this.commonService.validateMongoID(chatId)) {
      throw new BadRequestException(["invalid chat id"]);
    }
    return this.chatService.addMessage(chatId, body);
  }

  @Put(":chatId/messages/:messageId")
  async updateMessage(
    @Param("chatId") chatId: string,
    @Param("messageId") messageId: string,
    @Body() body: ChatConversationDTO,
  ): Promise<ChatConversationDocument> {
    await this.chatService.getMessageById(chatId, messageId);
    return this.chatService.updateMessageById(chatId, messageId, body);
  }

  @Delete(":chatId/messages/:messageId")
  deleteMessage(
    @Param("chatId") chatId: string,
    @Param("messageId") messageId: string,
  ): Promise<ChatConversationDocument> {
    if (
      !this.commonService.validateMongoID(chatId) ||
      !this.commonService.validateMongoID(messageId)
    ) {
      throw new BadRequestException(["invalid chat_id or message_id"]);
    }
    return this.chatService.deleteMessageById(chatId, messageId);
  }

  @Delete(":chatId")
  async deleteChat(@Param("chatId") chatId: string) {
    await this.chatService.getChatByUsersIds([], chatId);
    return this.chatService.deleteChatById(chatId);
  }
}

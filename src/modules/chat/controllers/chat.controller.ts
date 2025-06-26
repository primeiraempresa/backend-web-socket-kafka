import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
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
import { ChatPagination } from "@chat/models/chatPagination.model";
import { ChatProducerService } from "@chat/services/chat.producer.service";
import { ChatConversation } from "@chat/models/chat_conversation.model";
import { CommonService } from "@common/services/common.service";
import { Chats } from "@chat/models/chat.model";
import { Observable } from "rxjs";
import { ChatConversationT } from "@chat/interfaces/chat_conversation-T.interface";
import { Chat_conversation_messageT } from "@chat/interfaces/chat_conversation_message-T.interface";
import { Chat_T } from "@chat/interfaces/chat-T.interface";
import {
  CHAT_PRODUCER_SERVICE_CREATE_CHAT,
  CHAT_PRODUCER_SERVICE_CREATE_MESSAGE,
  CHAT_PRODUCER_SERVICE_DELETE_CHAT,
  CHAT_PRODUCER_SERVICE_DELETE_MESSAGE,
  CHAT_PRODUCER_SERVICE_UPDATE_MESSAGE,
} from "@common/tokens/chat.tokens";

@Controller("chat")
@UseGuards(AuthGuard("jwt"))
@ApiOAuth2(["read", "write"], "oauth2")
@ApiTags("Chat")
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    @Inject(CHAT_PRODUCER_SERVICE_CREATE_CHAT)
    private readonly chatProducerService_createChat: ChatProducerService<Chats>,
    @Inject(CHAT_PRODUCER_SERVICE_CREATE_MESSAGE)
    private readonly chatProducerService_createMessage: ChatProducerService<ChatConversationT>,
    @Inject(CHAT_PRODUCER_SERVICE_UPDATE_MESSAGE)
    private readonly chatProducerService_updateMessage: ChatProducerService<Chat_conversation_messageT>,
    @Inject(CHAT_PRODUCER_SERVICE_DELETE_MESSAGE)
    private readonly chatProducerService_deleteMessage: ChatProducerService<Chat_T>,
    @Inject(CHAT_PRODUCER_SERVICE_DELETE_CHAT)
    private readonly chatProducerService_deleteChat: ChatProducerService<{
      chatId: string;
    }>,
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
  @Post()
  createChat(@Body() body: Chats): Observable<Chats> {
    if (!this.commonService.validateArryByMongoIDs(body.chatters)) {
      throw new BadRequestException(["invalid userIds"]);
    }
    return this.chatProducerService_createChat.sendMessage("chat.create", body);
  }

  @Post("/:chatId/messages")
  createMessage(
    @Param("chatId") chatId: string,
    @Body() body: ChatConversation,
  ): Observable<ChatConversationT> {
    if (!this.commonService.validateMongoID(chatId)) {
      throw new BadRequestException(["invalid chat id"]);
    }
    return this.chatProducerService_createMessage.sendMessage(
      "chat.message.create",
      {
        chatId,
        chat_conversation: body,
      },
    );
  }

  @Put(":chatId/messages/:messageId")
  async updateMessage(
    @Param("chatId") chatId: string,
    @Param("messageId") messageId: string,
    @Body() body: ChatConversationDTO,
  ): Promise<Observable<Chat_conversation_messageT>> {
    await this.chatService.getMessageById(chatId, messageId);
    return this.chatProducerService_updateMessage.sendMessage(
      "chat.message.update",
      {
        chatId,
        messageId,
        chat_conversation: body,
      },
    );
  }

  @Delete(":chatId/messages/:messageId")
  deleteMessage(
    @Param("chatId") chatId: string,
    @Param("messageId") messageId: string,
  ): Observable<Chat_T> {
    if (
      !this.commonService.validateMongoID(chatId) ||
      !this.commonService.validateMongoID(messageId)
    ) {
      throw new BadRequestException(["invalid chat_id or message_id"]);
    }
    return this.chatProducerService_deleteMessage.sendMessage(
      "chat.message.delete",
      {
        chatId,
        messageId,
      },
    );
  }

  @Delete(":chatId")
  async deleteChat(@Param("chatId") chatId: string): Promise<
    Observable<{
      chatId: string;
    }>
  > {
    await this.chatService.getChatByUsersIds([], chatId);
    return this.chatProducerService_deleteChat.sendMessage("chat.delete", {
      chatId,
    });
  }
}

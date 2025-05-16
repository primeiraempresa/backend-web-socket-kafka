import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { ChatDocument } from "../schemas/chat.schema";
import { Connection, Model } from "mongoose";
import { ChatPagination } from "../models/chatPagination.model";
import { Chats } from "../models/chat.model";
import {
  ChatConversationDocument,
  ChatConversationSchema,
} from "../schemas/chat_conversation.schema";
import { Chat_conversation } from "../models/chat_conversation.model";
import { CommonService } from "@common/services/common.service";
import { Chat_conversation_DTO } from "../dto/chat_conversation.dto";

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chats.name) private readonly chatModel: Model<ChatDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly commonService: CommonService,
  ) {}
  async createChat(userIds: string[]): Promise<ChatDocument> {
    const newChat: ChatDocument = await this.chatModel.create({
      chatters: userIds,
    });
    const collectionName = newChat._id.toString();
    await this.connection.createCollection(`ChatMessage_${collectionName}`);
    return newChat;
  }
  async addMessage(
    chatId: string,
    senderId: string,
    message: string,
  ): Promise<ChatConversationDocument> {
    const collectionName = chatId;
    const messageModel: Model<Chat_conversation> = this.connection.model(
      `ChatMessage_${collectionName}`,
      ChatConversationSchema,
      `ChatMessage_${collectionName}`,
    );
    return await messageModel.create({ sender: senderId, message });
  }
  async getMessages(
    chatId: string,
    page: number,
    limit: number,
  ): Promise<ChatPagination> {
    const skip = (page - 1) * limit;
    const messageModel: Model<Chat_conversation> = this.connection.model(
      `ChatMessage_${chatId}`,
      ChatConversationSchema,
      `ChatMessage_${chatId}`,
    );
    const [items, totalItems] = await Promise.all([
      await messageModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("sender")
        .exec(),
      await messageModel.countDocuments(),
    ]);
    if (!items || items.length < 1) {
      throw new NotFoundException(["no messages found"]);
    }
    return {
      items,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
      nextPage: page * limit < totalItems ? page + 1 : null,
    };
  }
  async getChatByUsersIds(
    userIds?: string[],
    _id?: string,
  ): Promise<ChatDocument> {
    if (_id && !this.commonService.validateMongoID(_id)) {
      throw new BadRequestException(["invalid chat id"]);
    }
    if (userIds && !this.commonService.validateArryByMongoIDs(userIds)) {
      throw new BadRequestException(["invalid users ids"]);
    }
    const newChat = await this.chatModel
      .findOne({
        $or: [
          {
            chatters: {
              $all: userIds,
            },
          },
          { _id },
        ],
      })
      .populate("chatters");
    if (!newChat) {
      throw new NotFoundException(["chat not found"]);
    }
    return newChat;
  }
  async getMessageById(
    chatId: string,
    message_id: string,
  ): Promise<ChatConversationDocument> {
    if (!this.commonService.validateMongoID(message_id)) {
      throw new BadRequestException(["invalid message id"]);
    }
    if (!this.commonService.validateMongoID(chatId)) {
      throw new BadRequestException(["invalid chat id"]);
    }
    const messageModel: Model<Chat_conversation> = this.connection.model(
      `ChatMessage_${chatId}`,
      ChatConversationSchema,
      `ChatMessage_${chatId}`,
    );
    const findById = await messageModel
      .findOne({ _id: message_id })
      .populate("sender");
    if (!findById) {
      throw new NotFoundException(["message not found"]);
    }
    return findById;
  }
  async updateMessageById(
    chatId: string,
    message_id: string,
    body: Chat_conversation_DTO,
  ): Promise<ChatConversationDocument> {
    console.log(body);
    if (!this.commonService.validateMongoID(message_id)) {
      throw new BadRequestException(["invalid message id"]);
    }
    if (!this.commonService.validateMongoID(chatId)) {
      throw new BadRequestException(["invalid chat id"]);
    }
    const messageModel: Model<Chat_conversation> = this.connection.model(
      `ChatMessage_${chatId}`,
      ChatConversationSchema,
      `ChatMessage_${chatId}`,
    );
    const updateMessageById = await messageModel
      .findByIdAndUpdate(message_id, body, {
        new: true,
        runValidators: true,
      })
      .exec();
    if (!updateMessageById) {
      throw new NotFoundException(["message not found"]);
    }
    return updateMessageById;
  }
  async deleteMessageById(
    chatId: string,
    message_id: string,
  ): Promise<ChatConversationDocument> {
    if (!this.commonService.validateMongoID(message_id)) {
      throw new BadRequestException(["invalid message id"]);
    }
    if (!this.commonService.validateMongoID(chatId)) {
      throw new BadRequestException(["invalid chat id"]);
    }
    const messageModel: Model<Chat_conversation> = this.connection.model(
      `ChatMessage_${chatId}`,
      ChatConversationSchema,
      `ChatMessage_${chatId}`,
    );
    const deleteMessageById = await messageModel
      .findByIdAndDelete(message_id)
      .exec();
    if (!deleteMessageById) {
      throw new NotFoundException(["message not found"]);
    }
    return deleteMessageById;
  }
  async deleteChatById(_id: string): Promise<ChatDocument> {
    if (!this.commonService.validateMongoID(_id)) {
      throw new BadRequestException(["invalid chat id"]);
    }
    const deleteChatById = await this.chatModel.findByIdAndDelete(_id);
    if (!deleteChatById) {
      throw new NotFoundException(["chat not found"]);
    }
    const collectionName = deleteChatById._id.toString();
    await this.connection.dropCollection(`ChatMessage_${collectionName}`);
    return deleteChatById;
  }
}

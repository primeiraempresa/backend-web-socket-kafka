import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { ChatDocument } from "../../schemas/chat.schema";
import { Connection, Model } from "mongoose";
import { ChatPagination } from "../../models/chatPagination.model";
import { Chats } from "../../models/chat.model";
import {
  ChatConversationDocument,
  ChatConversationSchema,
} from "../../schemas/chat_conversation.schema";
import { Chat_conversation } from "../../models/chat_conversation.model";

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chats.name) private readonly chatModel: Model<ChatDocument>,
    @InjectConnection() private readonly connection: Connection,
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
    const [conversation, totalItems] = await Promise.all([
      await messageModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("sender")
        .exec(),
      await messageModel.countDocuments(),
    ]);
    if (!conversation || conversation.length < 1) {
      throw new NotFoundException(["no messages found"]);
    }
    return {
      conversation,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
      nextPage: page * limit < totalItems ? page + 1 : null,
    };
  }
}

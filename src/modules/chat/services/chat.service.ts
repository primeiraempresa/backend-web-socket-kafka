import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { ChatsDocument } from "../schemas/chat.schema";
import mongoose, { Connection, Model } from "mongoose";
import { ChatPagination } from "../models/chatPagination.model";
import { Chats } from "../models/chat.model";
import {
  ChatConversationDocument,
  ChatConversationSchema,
} from "../schemas/chat_conversation.schema";
import { ChatConversation } from "../models/chat_conversation.model";
import { CommonService } from "@common/services/common.service";
import { ChatConversationDTO } from "../dto/chat_conversation.dto";
import { UploadService } from "@upload/services/upload.service";
import { Queue } from "bull";
import { InjectQueue } from "@nestjs/bull";
import { FilesDocument } from "@upload/schemas/files.schema";

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chats.name) private readonly chatModel: Model<ChatsDocument>,
    @InjectConnection() private readonly connection: Connection,
    @InjectQueue("chat.process") private readonly queue: Queue,
    private readonly commonService: CommonService,
    private readonly uploadService: UploadService,
  ) {}
  async createChat(userIds: string[]): Promise<ChatsDocument> {
    try {
      const chatExists = await this.getChatByUsersIds(userIds);
      return chatExists;
    } catch {
      const newChat: ChatsDocument = await this.chatModel.create({
        chatters: userIds,
      });
      const collectionName = newChat._id.toString();
      await this.connection.createCollection(`ChatMessage_${collectionName}`);
      return newChat.populate("chatters");
    }
  }
  async getChatsByUserId(userId: string) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const chats = await this.chatModel
      .find({
        chatters: { $in: [userObjectId] },
      })
      .populate("chatters")
      .exec();
    if (chats.length < 1) {
      throw new NotFoundException(["no chats found"]);
    }
    const chatsWithoutUser = chats.map((chat) => {
      const otherChatters = chat.chatters.filter(
        (chatter: any) => chatter._id.toString() !== userId,
      );
      return {
        ...chat.toObject(),
        chatters: otherChatters,
      };
    });

    return chatsWithoutUser;
  }
  async addMessage(
    chatId: string,
    chat_conversation: ChatConversation,
  ): Promise<ChatConversationDocument> {
    const collectionName = chatId;
    const messageModel: Model<ChatConversation> = this.connection.model(
      `ChatMessage_${collectionName}`,
      ChatConversationSchema,
      `ChatMessage_${collectionName}`,
    );
    if (
      !chat_conversation.message &&
      (!chat_conversation.images || chat_conversation.images.length === 0) &&
      !chat_conversation.file
    ) {
      throw new BadRequestException(
        "The message must contain text, images or a file. ",
      );
    }
    const newMessage = await messageModel.create(chat_conversation);

    await newMessage.populate("sender");
    await newMessage.populate("images");
    await newMessage.populate("file");
    return newMessage;
  }
  async getMessages(
    chatId: string,
    page: number,
    limit: number,
  ): Promise<ChatPagination> {
    if (!this.commonService.validateMongoID(chatId)) {
      throw new BadRequestException(["invalid chat id"]);
    }
    const skip = (page - 1) * limit;
    const messageModel: Model<ChatConversation> = this.connection.model(
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
        .populate("images")
        .populate("file")
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
  ): Promise<ChatsDocument> {
    if (_id && !this.commonService.validateMongoID(_id)) {
      throw new BadRequestException(["invalid chat id"]);
    }
    if (
      userIds &&
      Array.isArray(userIds) &&
      !this.commonService.validateArryByMongoIDs(userIds)
    ) {
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
    const messageModel: Model<ChatConversation> = this.connection.model(
      `ChatMessage_${chatId}`,
      ChatConversationSchema,
      `ChatMessage_${chatId}`,
    );
    const findById = await messageModel
      .findOne({ _id: message_id })
      .populate("sender")
      .populate("images")
      .populate("file");
    if (!findById) {
      throw new NotFoundException(["message not found"]);
    }
    return findById;
  }
  async updateMessageById(
    chatId: string,
    message_id: string,
    body: ChatConversationDTO,
  ): Promise<ChatConversationDocument> {
    if (!this.commonService.validateMongoID(message_id)) {
      throw new BadRequestException(["invalid message id"]);
    }
    if (!this.commonService.validateMongoID(chatId)) {
      throw new BadRequestException(["invalid chat id"]);
    }
    const messageModel: Model<ChatConversation> = this.connection.model(
      `ChatMessage_${chatId}`,
      ChatConversationSchema,
      `ChatMessage_${chatId}`,
    );
    const currentMessage = await messageModel
      .findById(message_id)
      .populate("images")
      .exec();
    if (!currentMessage) {
      throw new NotFoundException(["message not found"]);
    }
    let removedImages: FilesDocument[] = [];
    const currentImages = currentMessage.images ?? [];
    const newImageIds = (body.images ?? []).map((img) => img._id.toString());
    removedImages = currentImages.filter(
      (img) => !newImageIds.includes(img._id.toString()),
    );
    if (body?.images?.length === 0) {
      body.images = null;
    }
    const updateData: Partial<ChatConversationDTO> = { ...body };
    const updatedMessage = await messageModel
      .findByIdAndUpdate(message_id, updateData, {
        new: true,
        runValidators: true,
      })
      .populate("sender")
      .populate("images")
      .populate("file")
      .exec();

    if (!updatedMessage) {
      throw new NotFoundException(["message not found"]);
    }
    if (removedImages.length > 0) {
      await this.queue.add("file.delete", {
        files: {
          images: removedImages,
          file: null,
        },
      });
    }
    return updatedMessage;
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
    try {
      const messageModel: Model<ChatConversation> = this.connection.model(
        `ChatMessage_${chatId}`,
        ChatConversationSchema,
        `ChatMessage_${chatId}`,
      );
      const deleteMessageById = await messageModel
        .findByIdAndDelete(message_id)
        .populate("sender")
        .populate("images")
        .populate("file")
        .exec();
      if (!deleteMessageById) {
        throw new NotFoundException(["message not found"]);
      }
      if (deleteMessageById?.images) {
        for (const item of deleteMessageById.images) {
          await this.uploadService.deleteFile(item._id.toString());
        }
      }
      if (deleteMessageById?.file) {
        await this.uploadService.deleteFile(
          deleteMessageById.file._id.toString(),
        );
      }
      return deleteMessageById;
    } catch (error) {
      console.error("MongoDB Update Error:", error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }
  async deleteChatById(_id: string) {
    if (!this.commonService.validateMongoID(_id)) {
      throw new BadRequestException(["invalid chat id"]);
    }
    const findChatById = await this.chatModel.findById(_id);
    if (!findChatById) {
      throw new NotFoundException(["chat not found"]);
    }
    return await this.queue.add("chat.delete", findChatById);
  }
}

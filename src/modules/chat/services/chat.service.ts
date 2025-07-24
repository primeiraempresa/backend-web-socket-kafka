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
import { DateService } from "@common/services/date.service";
import { Users } from "@user/models/user.model";
import { ChatNotificationService } from "./chat-notification.service";

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chats.name) private readonly chatModel: Model<ChatsDocument>,
    @InjectConnection() private readonly connection: Connection,
    @InjectQueue("chat.process") private readonly queue: Queue,
    private readonly commonService: CommonService,
    private readonly uploadService: UploadService,
    private readonly chatNotificationService: ChatNotificationService,
  ) {}

  // ===== MÉTODOS EXISTENTES (mantidos e melhorados) =====

  async createChat(userIds: string[]): Promise<ChatsDocument> {
    try {
      const chatExists = await this.getChatByUsersIds(userIds);
      return chatExists;
    } catch {
      // Inicializar contadores e configurações para cada usuário
      const unreadCount = new Map<string, number>();
      const lastSeenAt = new Map<string, Date>();
      const notificationsEnabled = new Map<string, boolean>();
      const isArchived = new Map<string, boolean>();
      const isMuted = new Map<string, boolean>();

      userIds.forEach((userId) => {
        unreadCount.set(userId, 0);
        lastSeenAt.set(userId, new Date());
        notificationsEnabled.set(userId, true);
        isArchived.set(userId, false);
        isMuted.set(userId, false);
      });

      const newChat: ChatsDocument = await this.chatModel.create({
        chatters: userIds,
        chatType: userIds.length === 2 ? "individual" : "group",
        unreadCount,
        lastSeenAt,
        notificationsEnabled,
        isArchived,
        isMuted,
      });

      const collectionName = newChat._id.toString();
      await this.connection.createCollection(`ChatMessage_${collectionName}`);

      const populatedChat = await newChat.populate("chatters");

      // Notificar criação do chat
      await this.chatNotificationService.notifyChatStatusChange({
        type: "chat_created",
        chatId: newChat._id.toString(),
        userId: userIds[0], // Assumindo que o primeiro usuário é o criador
        affectedUserIds: userIds,
        chat: populatedChat,
        timestamp: new Date(),
      });

      return populatedChat;
    }
  }

  async getChatsByUserId(userId: string, includeArchived: boolean = false) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const matchConditions: any = {
      chatters: { $in: [userObjectId] },
    };

    // Filtrar chats arquivados se necessário
    if (!includeArchived) {
      matchConditions[`isArchived.${userId}`] = { $ne: true };
    }

    const chats = await this.chatModel
      .find(matchConditions)
      .populate("chatters")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          model: Users.name,
        },
      })
      .sort({ updatedAt: -1 })
      .exec();

    if (chats.length < 1) {
      throw new NotFoundException(["no chats found"]);
    }

    const chatsWithMetadata = chats.map((chat) => {
      const otherChatters = chat.chatters.filter(
        (chatter: any) => chatter._id.toString() !== userId,
      );

      return {
        ...chat.toObject(),
        chatters: otherChatters,
        unreadCount: chat.unreadCount?.get(userId) || 0,
        lastSeenAt: chat.lastSeenAt?.get(userId),
        isArchived: chat.isArchived?.get(userId) || false,
        isMuted: chat.isMuted?.get(userId) || false,
        notificationsEnabled: chat.notificationsEnabled?.get(userId) !== false,
      };
    });

    return chatsWithMetadata;
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

    // Determinar tipo da mensagem
    let messageType = "text";
    if (chat_conversation.images && chat_conversation.images.length > 0) {
      messageType = "image";
    } else if (chat_conversation.file) {
      messageType = "file";
    }

    const messageData = {
      ...chat_conversation,
      messageType,
      readBy: [chat_conversation.sender], // Remetente já "leu" a mensagem
      readAt: new Map([[chat_conversation.sender, new Date()]]),
      deliveredTo: [],
      deliveredAt: new Map(),
    };

    const newMessage = await messageModel.create(messageData);

    await newMessage.populate("sender");
    await newMessage.populate("images");
    await newMessage.populate("file");

    // Atualizar chat com última mensagem
    await this.chatModel.findByIdAndUpdate(chatId, {
      updatedAt: new DateService().now(),
      lastMessage: newMessage,
    });

    // Obter participantes do chat para notificação
    const chat = await this.chatModel.findById(chatId);
    if (chat) {
      const recipientIds = chat.chatters
        .filter((id) => id.toString() !== chat_conversation.sender.toString())
        .map((id) => id.toString());

      // Notificar nova mensagem
      await this.chatNotificationService.notifyNewMessage(
        chatId,
        newMessage,
        recipientIds,
      );
    }

    return newMessage;
  }

  async getMessages(
    chatId: string,
    page: number,
    limit: number,
    userId?: string,
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

    // Filtrar mensagens deletadas
    const filter = { isDeleted: { $ne: true } };

    const [items, totalItems] = await Promise.all([
      await messageModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("sender")
        .populate("images")
        .populate("file")
        .exec(),
      await messageModel.countDocuments(filter),
    ]);

    if (!items || items.length < 1) {
      throw new NotFoundException(["no messages found"]);
    }

    // Adicionar informações de leitura para o usuário atual
    const messagesWithReadStatus = items.map((message) => {
      const messageObj: any = message.toObject();
      if (userId) {
        messageObj.isReadByMe = message.readBy?.includes(userId) || false;
        messageObj.readAtByMe = message.readAt?.get(userId);
        messageObj.isDeliveredToMe =
          message.deliveredTo?.includes(userId) || false;
        messageObj.deliveredAtToMe = message.deliveredAt?.get(userId);
      }
      return messageObj;
    });

    return {
      items: messagesWithReadStatus,
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
      .populate("chatters")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          model: Users.name,
        },
      })
      .exec();

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
      .findOne({ _id: message_id, isDeleted: { $ne: true } })
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

    const updateData: Partial<ChatConversationDTO> = {
      ...body,
      isEdited: true,
      editedAt: new Date(),
    } as any;

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

    await this.chatModel.findByIdAndUpdate(
      chatId,
      {
        updatedAt: new DateService().now(),
      },
      {
        new: true,
        runValidators: true,
      },
    );

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

      // Soft delete - marcar como deletada ao invés de remover
      const deletedMessage = await messageModel
        .findByIdAndUpdate(
          message_id,
          {
            isDeleted: true,
            deletedAt: new Date(),
            message: null, // Limpar conteúdo da mensagem
            images: null,
            file: null,
          },
          { new: true },
        )
        .populate("sender")
        .exec();

      if (!deletedMessage) {
        throw new NotFoundException(["message not found"]);
      }

      // Remover arquivos se existirem
      if (deletedMessage?.images) {
        for (const item of deletedMessage.images) {
          await this.uploadService.deleteFile(item._id.toString());
        }
      }
      if (deletedMessage?.file) {
        await this.uploadService.deleteFile(deletedMessage.file._id.toString());
      }

      return deletedMessage;
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

  // ===== NOVOS MÉTODOS PARA FUNCIONALIDADES AVANÇADAS =====

  async markAllMessagesAsRead(chatId: string, userId: string): Promise<void> {
    const messageModel: Model<ChatConversation> = this.connection.model(
      `ChatMessage_${chatId}`,
      ChatConversationSchema,
      `ChatMessage_${chatId}`,
    );

    // Buscar mensagens não lidas pelo usuário
    const unreadMessages = await messageModel.find({
      readBy: { $nin: [userId] },
      isDeleted: { $ne: true },
    });

    // Marcar todas como lidas
    for (const message of unreadMessages) {
      const readBy = message.readBy || [];
      const readAt = message.readAt || new Map();

      if (!readBy.includes(userId)) {
        readBy.push(userId);
        readAt.set(userId, new Date());

        await messageModel.findByIdAndUpdate(message._id, { readBy, readAt });
      }
    }

    // Resetar contador de não lidas
    await this.chatModel.findByIdAndUpdate(chatId, {
      [`unreadCount.${userId}`]: 0,
      [`lastSeenAt.${userId}`]: new Date(),
    });
  }

  async getUnreadCounts(userId: string): Promise<{ [chatId: string]: number }> {
    const userChats = await this.chatModel.find({
      chatters: { $in: [new mongoose.Types.ObjectId(userId)] },
    });

    const unreadCounts: { [chatId: string]: number } = {};

    for (const chat of userChats) {
      const count = chat.unreadCount?.get(userId) || 0;
      unreadCounts[chat._id.toString()] = count;
    }

    return unreadCounts;
  }

  async getUndeliveredMessages(
    chatId: string,
    userId: string,
  ): Promise<ChatConversationDocument[]> {
    const messageModel: Model<ChatConversation> = this.connection.model(
      `ChatMessage_${chatId}`,
      ChatConversationSchema,
      `ChatMessage_${chatId}`,
    );

    return await messageModel.find({
      deliveredTo: { $nin: [userId] },
      sender: { $ne: userId },
      isDeleted: { $ne: true },
    });
  }

  async muteChat(
    chatId: string,
    userId: string,
    muteUntil?: Date,
  ): Promise<void> {
    const updateData: any = {
      [`isMuted.${userId}`]: true,
    };

    if (muteUntil) {
      updateData[`muteUntil.${userId}`] = muteUntil;
    }

    await this.chatModel.findByIdAndUpdate(chatId, updateData);
  }

  async unmuteChat(chatId: string, userId: string): Promise<void> {
    await this.chatModel.findByIdAndUpdate(chatId, {
      [`isMuted.${userId}`]: false,
      $unset: { [`muteUntil.${userId}`]: 1 },
    });
  }

  async archiveChat(chatId: string, userId: string): Promise<void> {
    await this.chatModel.findByIdAndUpdate(chatId, {
      [`isArchived.${userId}`]: true,
    });
  }

  async unarchiveChat(chatId: string, userId: string): Promise<void> {
    await this.chatModel.findByIdAndUpdate(chatId, {
      [`isArchived.${userId}`]: false,
    });
  }

  async addReactionToMessage(
    chatId: string,
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<void> {
    const messageModel: Model<ChatConversation> = this.connection.model(
      `ChatMessage_${chatId}`,
      ChatConversationSchema,
      `ChatMessage_${chatId}`,
    );

    const message = await messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException(["message not found"]);
    }

    const reactions = message.reactions || new Map();
    const emojiReactions = reactions.get(emoji) || [];

    if (!emojiReactions.includes(userId)) {
      emojiReactions.push(userId);
      reactions.set(emoji, emojiReactions);

      await messageModel.findByIdAndUpdate(messageId, { reactions });
    }
  }

  async removeReactionFromMessage(
    chatId: string,
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<void> {
    const messageModel: Model<ChatConversation> = this.connection.model(
      `ChatMessage_${chatId}`,
      ChatConversationSchema,
      `ChatMessage_${chatId}`,
    );

    const message = await messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException(["message not found"]);
    }

    const reactions = message.reactions || new Map();
    const emojiReactions = reactions.get(emoji) || [];

    const updatedReactions = emojiReactions.filter((id) => id !== userId);

    if (updatedReactions.length === 0) {
      reactions.delete(emoji);
    } else {
      reactions.set(emoji, updatedReactions);
    }

    await messageModel.findByIdAndUpdate(messageId, { reactions });
  }

  async searchMessages(
    chatId: string,
    query: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<ChatPagination> {
    const messageModel: Model<ChatConversation> = this.connection.model(
      `ChatMessage_${chatId}`,
      ChatConversationSchema,
      `ChatMessage_${chatId}`,
    );

    const skip = (page - 1) * limit;
    const searchFilter = {
      message: { $regex: query, $options: "i" },
      isDeleted: { $ne: true },
    };

    const [items, totalItems] = await Promise.all([
      await messageModel
        .find(searchFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("sender")
        .populate("images")
        .populate("file")
        .exec(),
      await messageModel.countDocuments(searchFilter),
    ]);

    return {
      items,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
      nextPage: page * limit < totalItems ? page + 1 : null,
    };
  }

  async getChatStatistics(chatId: string): Promise<any> {
    const messageModel: Model<ChatConversation> = this.connection.model(
      `ChatMessage_${chatId}`,
      ChatConversationSchema,
      `ChatMessage_${chatId}`,
    );

    const stats = await messageModel.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          messagesByType: {
            $push: "$messageType",
          },
          messagesBySender: {
            $push: "$sender",
          },
          firstMessage: { $min: "$createdAt" },
          lastMessage: { $max: "$createdAt" },
        },
      },
    ]);

    return stats[0] || {};
  }
}

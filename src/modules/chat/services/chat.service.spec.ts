import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { getConnectionToken, getModelToken } from "@nestjs/mongoose";
import { getQueueToken } from "@nestjs/bull";
import mongoose from "mongoose";

import { ChatService } from "./chat.service";
import { CommonService } from "@common/services/common.service";
import { UploadService } from "@upload/services/upload.service";
import { Chats } from "../models/chat.model";
import { Users } from "@user/models/user.model";
import { Files } from "@upload/models/files.model";
import { ChatConversationSchema } from "../schemas/chat_conversation.schema";

jest.mock("@common/services/date.service", () => ({
  DateService: jest.fn().mockImplementation(() => ({
    now: jest.fn(() => new Date("2026-01-01T00:00:00.000Z")),
  })),
}));

const makeChain = <T>(result: T) => {
  const chain: any = {};
  chain.populate = jest.fn(() => chain);
  chain.sort = jest.fn(() => chain);
  chain.skip = jest.fn(() => chain);
  chain.limit = jest.fn(() => chain);
  chain.exec = jest.fn().mockResolvedValue(result);
  return chain;
};

describe("ChatService", () => {
  let service: ChatService;

  const commonServiceMock = {
    validateMongoID: jest.fn(),
    validateArryByMongoIDs: jest.fn(),
  };

  const uploadServiceMock = {
    deleteFile: jest.fn(),
  };

  const queueMock = {
    add: jest.fn(),
  };

  const chatModelMock = {
    findOne: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  };

  const userModelMock = {};
  const fileModelMock = {};

  const chatsConnectionMock = {
    createCollection: jest.fn(),
    model: jest.fn(),
  };

  const validUserId1 = new mongoose.Types.ObjectId().toString();
  const validUserId2 = new mongoose.Types.ObjectId().toString();
  const validUserId3 = new mongoose.Types.ObjectId().toString();
  const validChatId = new mongoose.Types.ObjectId().toString();
  const validMessageId = new mongoose.Types.ObjectId().toString();

  beforeEach(async () => {
    jest.clearAllMocks();

    commonServiceMock.validateMongoID.mockReturnValue(true);
    commonServiceMock.validateArryByMongoIDs.mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getConnectionToken("ChatsConnection"),
          useValue: chatsConnectionMock,
        },
        {
          provide: getModelToken(Chats.name, "Datas"),
          useValue: chatModelMock,
        },
        {
          provide: getModelToken(Users.name, "Datas"),
          useValue: userModelMock,
        },
        {
          provide: getModelToken(Files.name, "Datas"),
          useValue: fileModelMock,
        },
        { provide: getQueueToken("chat.process"), useValue: queueMock },
        { provide: CommonService, useValue: commonServiceMock },
        { provide: UploadService, useValue: uploadServiceMock },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  describe("createChat", () => {
    it("should return an existing chat populated with chatters", async () => {
      const populatedChat = {
        _id: validChatId,
        chatters: [{ _id: validUserId1 }],
      };

      const existingChat = {
        populate: jest.fn().mockResolvedValue(populatedChat),
      };

      chatModelMock.findOne.mockResolvedValue(existingChat);

      const result = await service.createChat([validUserId1, validUserId2]);

      expect(chatModelMock.findOne).toHaveBeenCalledWith({
        chatters: { $all: [validUserId1, validUserId2] },
      });
      expect(existingChat.populate).toHaveBeenCalledWith("chatters");
      expect(chatsConnectionMock.createCollection).not.toHaveBeenCalled();
      expect(result).toBe(populatedChat);
    });

    it("should create a new chat and create the message collection", async () => {
      const newChat = {
        _id: new mongoose.Types.ObjectId(validChatId),
        populate: jest.fn().mockResolvedValue({
          _id: validChatId,
          chatters: [validUserId1, validUserId2],
        }),
      };

      chatModelMock.findOne.mockResolvedValue(null);
      chatModelMock.create.mockResolvedValue(newChat);

      const result = await service.createChat([validUserId1, validUserId2]);

      expect(chatModelMock.create).toHaveBeenCalledWith({
        chatters: [validUserId1, validUserId2],
      });
      expect(chatsConnectionMock.createCollection).toHaveBeenCalledWith(
        `ChatMessage_${validChatId}`,
      );
      expect(newChat.populate).toHaveBeenCalledWith("chatters");
      expect(result).toEqual({
        _id: validChatId,
        chatters: [validUserId1, validUserId2],
      });
    });
  });

  describe("getChatsByUserId", () => {
    it("should throw NotFoundException when no chats are found", async () => {
      const findChain = makeChain([]);
      chatModelMock.find.mockReturnValue(findChain);

      await expect(
        service.getChatsByUserId(validUserId1),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("should return chats without the current user", async () => {
      const chat = {
        chatters: [
          { _id: new mongoose.Types.ObjectId(validUserId1) },
          { _id: new mongoose.Types.ObjectId(validUserId2) },
        ],
        toObject: () => ({
          _id: validChatId,
          chatters: [
            { _id: new mongoose.Types.ObjectId(validUserId1) },
            { _id: new mongoose.Types.ObjectId(validUserId2) },
          ],
          lastMessage: null,
        }),
      };

      const findChain = makeChain([chat]);
      chatModelMock.find.mockReturnValue(findChain);

      const result = (await service.getChatsByUserId(validUserId1)) as any;

      expect(chatModelMock.find).toHaveBeenCalledWith({
        chatters: { $in: [new mongoose.Types.ObjectId(validUserId1)] },
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          _id: validChatId,
          lastMessage: null,
        }),
      );
      expect(result[0].chatters).toHaveLength(1);
      expect(result[0].chatters[0]._id.toString()).toBe(validUserId2);
    });
  });

  describe("addMessage", () => {
    it("should throw BadRequestException when message, images and file are missing", async () => {
      await expect(
        service.addMessage(validChatId, {
          message: "",
          images: [],
          file: null,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should create a message, populate relations and update the chat when file exists", async () => {
      const messageModelMock = {
        create: jest.fn(),
      };

      chatsConnectionMock.model.mockReturnValue(messageModelMock);

      const newMessage: any = {
        _id: validMessageId,
        message: "hello",
        images: [{ _id: validUserId3 }],
        file: { _id: validUserId2 },
        populate: jest.fn().mockResolvedValue(undefined),
      };

      messageModelMock.create.mockResolvedValue(newMessage);
      chatModelMock.findByIdAndUpdate.mockResolvedValue({});

      const body = {
        message: "hello",
        images: [{ _id: validUserId3 }],
        file: { _id: validUserId2 },
      } as any;

      const result = await service.addMessage(validChatId, body);

      expect(chatsConnectionMock.model).toHaveBeenCalledWith(
        `ChatMessage_${validChatId}`,
        ChatConversationSchema,
        `ChatMessage_${validChatId}`,
      );
      expect(messageModelMock.create).toHaveBeenCalledWith(body);
      expect(newMessage.populate).toHaveBeenNthCalledWith(1, {
        path: "sender",
        model: userModelMock,
      });
      expect(newMessage.populate).toHaveBeenNthCalledWith(2, {
        path: "images",
        model: fileModelMock,
      });
      expect(newMessage.populate).toHaveBeenNthCalledWith(3, {
        path: "file",
        model: fileModelMock,
      });
      expect(chatModelMock.findByIdAndUpdate).toHaveBeenCalledWith(
        validChatId,
        {
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          lastMessage: newMessage,
        },
      );
      expect(result).toBe(newMessage);
    });

    it("should create a message without populating file when file is missing", async () => {
      const messageModelMock = {
        create: jest.fn(),
      };

      chatsConnectionMock.model.mockReturnValue(messageModelMock);

      const newMessage: any = {
        _id: validMessageId,
        message: "hello",
        images: [],
        file: null,
        populate: jest.fn().mockResolvedValue(undefined),
      };

      messageModelMock.create.mockResolvedValue(newMessage);
      chatModelMock.findByIdAndUpdate.mockResolvedValue({});

      const result = await service.addMessage(validChatId, {
        message: "hello",
        images: [],
        file: null,
      } as any);

      expect(newMessage.populate).toHaveBeenCalledTimes(2);
      expect(result).toBe(newMessage);
    });
  });

  describe("getMessages", () => {
    it("should throw BadRequestException for invalid chat id", async () => {
      commonServiceMock.validateMongoID.mockReturnValue(false);

      await expect(
        service.getMessages("invalid-id", 1, 10),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should throw NotFoundException when there are no messages", async () => {
      commonServiceMock.validateMongoID.mockReturnValue(true);

      const messageModelMock = {
        find: jest.fn(),
        countDocuments: jest.fn(),
      };

      chatsConnectionMock.model.mockReturnValue(messageModelMock);

      const findChain = makeChain([]);
      messageModelMock.find.mockReturnValue(findChain);
      messageModelMock.countDocuments.mockResolvedValue(0);

      await expect(
        service.getMessages(validChatId, 1, 10),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("should return paginated messages", async () => {
      commonServiceMock.validateMongoID.mockReturnValue(true);

      const messageModelMock = {
        find: jest.fn(),
        countDocuments: jest.fn(),
      };

      chatsConnectionMock.model.mockReturnValue(messageModelMock);

      const items = [{ _id: validMessageId, message: "msg-1" }];
      const findChain = makeChain(items);

      messageModelMock.find.mockReturnValue(findChain);
      messageModelMock.countDocuments.mockResolvedValue(11);

      const result = await service.getMessages(validChatId, 1, 10);

      expect(result).toEqual({
        items,
        totalItems: 11,
        totalPages: 2,
        currentPage: 1,
        nextPage: 2,
      });
      expect(findChain.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(findChain.skip).toHaveBeenCalledWith(0);
      expect(findChain.limit).toHaveBeenCalledWith(10);
    });
  });

  describe("getChatByUsersIds", () => {
    it("should throw BadRequestException for invalid chat id", async () => {
      commonServiceMock.validateMongoID.mockImplementation((value: string) => {
        if (value === "invalid-chat-id") return false;
        return true;
      });
      commonServiceMock.validateArryByMongoIDs.mockReturnValue(true);

      await expect(
        service.getChatByUsersIds(
          [validUserId1, validUserId2],
          "invalid-chat-id",
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should throw BadRequestException for invalid users ids", async () => {
      commonServiceMock.validateMongoID.mockReturnValue(true);
      commonServiceMock.validateArryByMongoIDs.mockReturnValue(false);

      await expect(
        service.getChatByUsersIds(["bad-id"], validChatId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should throw NotFoundException when chat is not found", async () => {
      const findChain = makeChain(null);
      chatModelMock.findOne.mockReturnValue(findChain);

      await expect(
        service.getChatByUsersIds([validUserId1, validUserId2], validChatId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("should return the chat when found", async () => {
      const chat = {
        _id: validChatId,
        chatters: [{ _id: validUserId1 }, { _id: validUserId2 }],
      };

      const findChain = makeChain(chat);
      chatModelMock.findOne.mockReturnValue(findChain);

      const result = await service.getChatByUsersIds(
        [validUserId1, validUserId2],
        validChatId,
      );

      expect(result).toBe(chat);
      expect(findChain.populate).toHaveBeenCalledTimes(2);
      expect(findChain.exec).toHaveBeenCalled();
    });
  });

  describe("getMessageById", () => {
    it("should throw BadRequestException for invalid message id", async () => {
      commonServiceMock.validateMongoID.mockImplementation((value: string) => {
        if (value === "bad-message-id") return false;
        return true;
      });

      await expect(
        service.getMessageById(validChatId, "bad-message-id"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should throw BadRequestException for invalid chat id", async () => {
      commonServiceMock.validateMongoID.mockImplementation((value: string) => {
        if (value === "bad-chat-id") return false;
        return true;
      });

      await expect(
        service.getMessageById("bad-chat-id", validMessageId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should throw NotFoundException when message is not found", async () => {
      const messageModelMock = {
        findOne: jest.fn(),
      };

      chatsConnectionMock.model.mockReturnValue(messageModelMock);
      messageModelMock.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      await expect(
        service.getMessageById(validChatId, validMessageId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("should return the message when found", async () => {
      const message = { _id: validMessageId, message: "hello" };

      const messageModelMock = {
        findOne: jest.fn(),
      };

      chatsConnectionMock.model.mockReturnValue(messageModelMock);
      messageModelMock.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(message),
          }),
        }),
      });

      const result = await service.getMessageById(validChatId, validMessageId);

      expect(result).toBe(message);
    });
  });

  describe("updateMessageById", () => {
    it("should throw BadRequestException for invalid message id", async () => {
      commonServiceMock.validateMongoID.mockImplementation((value: string) => {
        if (value === "bad-message-id") return false;
        return true;
      });

      await expect(
        service.updateMessageById("bad-chat-id", "bad-message-id", {} as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should throw BadRequestException for invalid chat id", async () => {
      commonServiceMock.validateMongoID.mockImplementation((value: string) => {
        if (value === "bad-chat-id") return false;
        return true;
      });

      await expect(
        service.updateMessageById("bad-chat-id", validMessageId, {} as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should throw NotFoundException when current message is not found", async () => {
      const messageModelMock = {
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
      };

      chatsConnectionMock.model.mockReturnValue(messageModelMock);

      messageModelMock.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.updateMessageById(validChatId, validMessageId, {} as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("should update the message, remove images and enqueue file deletion", async () => {
      const currentImages = [
        { _id: new mongoose.Types.ObjectId(validUserId1) },
        { _id: new mongoose.Types.ObjectId(validUserId2) },
      ];

      const updatedMessage = { _id: validMessageId, message: "updated" };

      const messageModelMock = {
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
      };

      chatsConnectionMock.model.mockReturnValue(messageModelMock);

      messageModelMock.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            images: currentImages,
          }),
        }),
      });

      messageModelMock.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(updatedMessage),
            }),
          }),
        }),
      });

      const body = {
        message: "updated",
        images: [{ _id: currentImages[0]._id }],
      } as any;

      const result = await service.updateMessageById(
        validChatId,
        validMessageId,
        body,
      );

      expect(queueMock.add).toHaveBeenCalledWith("file.delete", {
        files: {
          images: [currentImages[1]],
          file: null,
        },
      });
      expect(chatModelMock.findByIdAndUpdate).toHaveBeenCalledWith(
        validChatId,
        {
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      );
      expect(result).toBe(updatedMessage);
    });

    it("should update the message without enqueueing deletion when no images were removed", async () => {
      const currentImages = [
        { _id: new mongoose.Types.ObjectId(validUserId1) },
      ];

      const updatedMessage = { _id: validMessageId, message: "updated" };

      const messageModelMock = {
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
      };

      chatsConnectionMock.model.mockReturnValue(messageModelMock);

      messageModelMock.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            images: currentImages,
          }),
        }),
      });

      messageModelMock.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(updatedMessage),
            }),
          }),
        }),
      });

      const body = {
        message: "updated",
        images: [{ _id: currentImages[0]._id }],
      } as any;

      await service.updateMessageById(validChatId, validMessageId, body);

      expect(queueMock.add).not.toHaveBeenCalled();
    });
  });

  describe("deleteMessageById", () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    afterAll(() => {
      consoleErrorSpy.mockRestore();
    });

    it("should throw BadRequestException for invalid message id", async () => {
      commonServiceMock.validateMongoID.mockImplementation((value: string) => {
        if (value === "bad-message-id") return false;
        return true;
      });

      await expect(
        service.deleteMessageById(validChatId, "bad-message-id"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should throw BadRequestException for invalid chat id", async () => {
      commonServiceMock.validateMongoID.mockImplementation((value: string) => {
        if (value === "bad-chat-id") return false;
        return true;
      });

      await expect(
        service.deleteMessageById("bad-chat-id", validMessageId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should rethrow NotFoundException when message is not found", async () => {
      const messageModelMock = {
        findByIdAndDelete: jest.fn(),
      };

      chatsConnectionMock.model.mockReturnValue(messageModelMock);

      messageModelMock.findByIdAndDelete.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(null),
            }),
          }),
        }),
      });

      await expect(
        service.deleteMessageById(validChatId, validMessageId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("should delete attached files and return deleted message", async () => {
      const deletedMessage = {
        _id: validMessageId,
        images: [{ _id: new mongoose.Types.ObjectId(validUserId1) }],
        file: { _id: new mongoose.Types.ObjectId(validUserId2) },
      };

      const messageModelMock = {
        findByIdAndDelete: jest.fn(),
      };

      chatsConnectionMock.model.mockReturnValue(messageModelMock);

      messageModelMock.findByIdAndDelete.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(deletedMessage),
            }),
          }),
        }),
      });

      uploadServiceMock.deleteFile.mockResolvedValue(undefined);

      const result = await service.deleteMessageById(
        validChatId,
        validMessageId,
      );

      expect(uploadServiceMock.deleteFile).toHaveBeenCalledWith(
        deletedMessage.images[0]._id.toString(),
      );
      expect(uploadServiceMock.deleteFile).toHaveBeenCalledWith(
        deletedMessage.file._id.toString(),
      );
      expect(result).toBe(deletedMessage);
    });

    it("should throw InternalServerErrorException when an unexpected error happens", async () => {
      const messageModelMock = {
        findByIdAndDelete: jest.fn(),
      };

      chatsConnectionMock.model.mockReturnValue(messageModelMock);

      messageModelMock.findByIdAndDelete.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              exec: jest.fn().mockRejectedValue(new Error("db failure")),
            }),
          }),
        }),
      });

      await expect(
        service.deleteMessageById(validChatId, validMessageId),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe("deleteChatById", () => {
    it("should throw BadRequestException for invalid chat id", async () => {
      commonServiceMock.validateMongoID.mockReturnValue(false);

      await expect(
        service.deleteChatById("invalid-chat-id"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should throw NotFoundException when chat does not exist", async () => {
      chatModelMock.findById.mockResolvedValue(null);

      await expect(service.deleteChatById(validChatId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("should enqueue chat deletion when chat exists", async () => {
      const chat = {
        _id: validChatId,
        chatters: [validUserId1, validUserId2],
      };

      chatModelMock.findById.mockResolvedValue(chat);
      queueMock.add.mockResolvedValue({ ok: true });

      const result = await service.deleteChatById(validChatId);

      expect(queueMock.add).toHaveBeenCalledWith("chat.delete", chat);
      expect(result).toEqual({ ok: true });
    });
  });
});

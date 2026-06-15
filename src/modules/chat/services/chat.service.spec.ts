/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { getConnectionToken, getModelToken } from "@nestjs/mongoose";
import mongoose from "mongoose";
import { ChatService } from "./chat.service";
import { CommonService } from "@common/services/common.service";
import { UploadService } from "@upload/services/upload.service";
import { Chats } from "../models/chat.model";
import { Users } from "@user/models/user.model";
import { Files } from "@upload/models/files.model";
import { ChatConversationSchema } from "../schemas/chat_conversation.schema";
import { Sports } from "@user/models/sports.model";
import { ChatProducerService } from "./chat.producer.service";
import { UploadProducerService } from "@upload/services/upload.producer.service";

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

  const chatProducerServiceMock = {
    sendMessage: jest.fn(),
  };

  const uploadProducerServiceMock = {
    sendMessage: jest.fn(),
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
  const sportsMock = {};
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
        {
          provide: getModelToken(Sports.name, "Datas"),
          useValue: sportsMock,
        },
        { provide: CommonService, useValue: commonServiceMock },
        { provide: UploadService, useValue: uploadServiceMock },
        { provide: ChatProducerService, useValue: chatProducerServiceMock },
        {
          provide: UploadProducerService,
          useValue: uploadProducerServiceMock,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  describe("createChat", () => {
    it("should return an existing chat populated with chatters and nested sports", async () => {
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
      expect(existingChat.populate).toHaveBeenCalledWith({
        path: "chatters",
        populate: { path: "sports.sport", model: sportsMock },
      });
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
      expect(newChat.populate).toHaveBeenCalledWith({
        path: "chatters",
        populate: { path: "sports.sport", model: sportsMock },
      });
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
      expect(findChain.populate).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({ _id: validChatId, lastMessage: null }),
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

    it("should throw BadRequestException when images is undefined and no message/file", async () => {
      await expect(
        service.addMessage(validChatId, {
          message: "",
          images: undefined,
          file: null,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should create a message and populate file when file exists", async () => {
      const messageModelMock = { create: jest.fn() };
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
      expect(newMessage.populate).toHaveBeenCalledTimes(4);
      expect(newMessage.populate).toHaveBeenNthCalledWith(1, {
        path: "sender",
        model: userModelMock,
      });
      expect(newMessage.populate).toHaveBeenNthCalledWith(2, {
        path: "sender",
        model: userModelMock,
        populate: { path: "sports.sport", model: sportsMock },
      });
      expect(newMessage.populate).toHaveBeenNthCalledWith(3, {
        path: "images",
        model: fileModelMock,
      });
      expect(newMessage.populate).toHaveBeenNthCalledWith(4, {
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

    it("should skip file populate when file is null", async () => {
      const messageModelMock = { create: jest.fn() };
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

      await service.addMessage(validChatId, {
        message: "hello",
        images: [],
        file: null,
      } as any);

      expect(newMessage.populate).toHaveBeenCalledTimes(3);
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

    it("should return paginated messages with nextPage", async () => {
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

    it("should return nextPage null on last page", async () => {
      const messageModelMock = {
        find: jest.fn(),
        countDocuments: jest.fn(),
      };

      chatsConnectionMock.model.mockReturnValue(messageModelMock);

      const items = [{ _id: validMessageId }];
      const findChain = makeChain(items);
      messageModelMock.find.mockReturnValue(findChain);
      messageModelMock.countDocuments.mockResolvedValue(10);

      const result = await service.getMessages(validChatId, 1, 10);

      expect(result.nextPage).toBeNull();
    });
  });

  describe("getChatByUsersIds", () => {
    it("should throw BadRequestException for invalid chat id", async () => {
      commonServiceMock.validateMongoID.mockImplementation(
        (value: string) => value !== "invalid-chat-id",
      );

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

    it("should skip userIds validation when userIds is undefined", async () => {
      const chat = { _id: validChatId, chatters: [] };
      const findChain = makeChain(chat);
      chatModelMock.findOne.mockReturnValue(findChain);

      const result = await service.getChatByUsersIds(undefined, validChatId);

      expect(commonServiceMock.validateArryByMongoIDs).not.toHaveBeenCalled();
      expect(result).toBe(chat);
    });

    it("should skip _id validation when _id is undefined", async () => {
      const chat = { _id: validChatId, chatters: [] };
      const findChain = makeChain(chat);
      chatModelMock.findOne.mockReturnValue(findChain);

      const result = await service.getChatByUsersIds([validUserId1]);

      expect(commonServiceMock.validateMongoID).not.toHaveBeenCalled();
      expect(result).toBe(chat);
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
      commonServiceMock.validateMongoID.mockImplementation(
        (value: string) => value !== "bad-message-id",
      );

      await expect(
        service.getMessageById(validChatId, "bad-message-id"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should throw BadRequestException for invalid chat id", async () => {
      commonServiceMock.validateMongoID.mockImplementation(
        (value: string) => value !== "bad-chat-id",
      );

      await expect(
        service.getMessageById("bad-chat-id", validMessageId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should throw NotFoundException when message is not found", async () => {
      const messageModelMock = { findOne: jest.fn() };
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
      const messageModelMock = { findOne: jest.fn() };
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
    const setupMessageModel = (currentMessage: any, updatedMessage: any) => {
      const messageModelMock = {
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
      };
      chatsConnectionMock.model.mockReturnValue(messageModelMock);

      messageModelMock.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(currentMessage),
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

      return messageModelMock;
    };

    it("should throw BadRequestException for invalid message id", async () => {
      commonServiceMock.validateMongoID.mockImplementation(
        (value: string) => value !== "bad-message-id",
      );

      await expect(
        service.updateMessageById(validChatId, "bad-message-id", {} as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should throw BadRequestException for invalid chat id", async () => {
      commonServiceMock.validateMongoID.mockImplementation(
        (value: string) => value !== "bad-chat-id",
      );

      await expect(
        service.updateMessageById("bad-chat-id", validMessageId, {} as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should throw NotFoundException when current message is not found", async () => {
      setupMessageModel(null, null);

      await expect(
        service.updateMessageById(validChatId, validMessageId, {} as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("should throw NotFoundException when updatedMessage is null", async () => {
      setupMessageModel({ images: [] }, null);

      await expect(
        service.updateMessageById(validChatId, validMessageId, {
          message: "x",
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("should update message and send removed images to upload producer", async () => {
      const img1Id = new mongoose.Types.ObjectId(validUserId1);
      const img2Id = new mongoose.Types.ObjectId(validUserId2);

      const currentImages = [
        { _id: img1Id, toJSON: () => ({ _id: img1Id }) },
        { _id: img2Id, toJSON: () => ({ _id: img2Id }) },
      ];

      const updatedMessage = { _id: validMessageId, message: "updated" };
      setupMessageModel({ images: currentImages }, updatedMessage);
      chatModelMock.findByIdAndUpdate.mockResolvedValue({});

      const body = {
        message: "updated",
        images: [{ _id: img1Id }],
      } as any;

      const result = await service.updateMessageById(
        validChatId,
        validMessageId,
        body,
      );

      expect(uploadProducerServiceMock.sendMessage).toHaveBeenCalledWith(
        "upload.delete.process",
        {
          images: [{ _id: img2Id }],
          file: undefined,
        },
      );
      expect(chatModelMock.findByIdAndUpdate).toHaveBeenCalledWith(
        validChatId,
        { updatedAt: new Date("2026-01-01T00:00:00.000Z") },
      );
      expect(result).toBe(updatedMessage);
    });

    it("should not send to upload producer when no images were removed", async () => {
      const imgId = new mongoose.Types.ObjectId(validUserId1);
      const currentImages = [{ _id: imgId, toJSON: () => ({ _id: imgId }) }];

      const updatedMessage = { _id: validMessageId, message: "updated" };
      setupMessageModel({ images: currentImages }, updatedMessage);
      chatModelMock.findByIdAndUpdate.mockResolvedValue({});

      await service.updateMessageById(validChatId, validMessageId, {
        message: "updated",
        images: [{ _id: imgId }],
      } as any);

      expect(uploadProducerServiceMock.sendMessage).not.toHaveBeenCalled();
    });

    it("should set body.images to null when body.images is empty array", async () => {
      const updatedMessage = { _id: validMessageId, message: "updated" };
      setupMessageModel({ images: [] }, updatedMessage);
      chatModelMock.findByIdAndUpdate.mockResolvedValue({});

      const body = { message: "updated", images: [] } as any;

      await service.updateMessageById(validChatId, validMessageId, body);

      expect(body.images).toBeNull();
    });

    it("should handle currentMessage.images being undefined", async () => {
      const updatedMessage = { _id: validMessageId, message: "updated" };
      setupMessageModel({ images: undefined }, updatedMessage);
      chatModelMock.findByIdAndUpdate.mockResolvedValue({});

      const result = await service.updateMessageById(
        validChatId,
        validMessageId,
        { message: "updated" } as any,
      );

      expect(uploadProducerServiceMock.sendMessage).not.toHaveBeenCalled();
      expect(result).toBe(updatedMessage);
    });
  });

  describe("deleteMessageById", () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    afterAll(() => {
      consoleErrorSpy.mockRestore();
    });

    const setupDeleteModel = (deletedMessage: any) => {
      const messageModelMock = { findByIdAndDelete: jest.fn() };
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
      return messageModelMock;
    };

    it("should throw BadRequestException for invalid message id", async () => {
      commonServiceMock.validateMongoID.mockImplementation(
        (value: string) => value !== "bad-message-id",
      );

      await expect(
        service.deleteMessageById(validChatId, "bad-message-id"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should throw BadRequestException for invalid chat id", async () => {
      commonServiceMock.validateMongoID.mockImplementation(
        (value: string) => value !== "bad-chat-id",
      );

      await expect(
        service.deleteMessageById("bad-chat-id", validMessageId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should rethrow NotFoundException when message is not found", async () => {
      setupDeleteModel(null);

      await expect(
        service.deleteMessageById(validChatId, validMessageId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("should delete attached images and file", async () => {
      const deletedMessage = {
        _id: validMessageId,
        images: [{ _id: new mongoose.Types.ObjectId(validUserId1) }],
        file: { _id: new mongoose.Types.ObjectId(validUserId2) },
      };

      setupDeleteModel(deletedMessage);
      jest.spyOn(uploadServiceMock, "deleteFile").mockResolvedValue(undefined);

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

    it("should skip file deletion when images and file are null", async () => {
      const deletedMessage = {
        _id: validMessageId,
        images: null,
        file: null,
      };

      setupDeleteModel(deletedMessage);

      const result = await service.deleteMessageById(
        validChatId,
        validMessageId,
      );

      expect(uploadServiceMock.deleteFile).not.toHaveBeenCalled();
      expect(result).toBe(deletedMessage);
    });

    it("should throw InternalServerErrorException on unexpected error", async () => {
      const messageModelMock = { findByIdAndDelete: jest.fn() };
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
      chatModelMock.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.deleteChatById(validChatId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("should send chat deletion via chatProducerService when chat exists", async () => {
      const chat = {
        _id: new mongoose.Types.ObjectId(validChatId),
        chatters: [validUserId1, validUserId2],
      };

      chatModelMock.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(chat),
      });

      chatProducerServiceMock.sendMessage.mockReturnValue({ ok: true });

      const result = await service.deleteChatById(validChatId);

      expect(chatProducerServiceMock.sendMessage).toHaveBeenCalledWith(
        "chat.delete.process",
        chat._id.toString(),
      );
      expect(result).toEqual({ ok: true });
    });
  });
});

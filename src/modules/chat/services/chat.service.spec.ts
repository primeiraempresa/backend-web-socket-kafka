/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { getConnectionToken, getModelToken } from "@nestjs/mongoose";
import { getQueueToken } from "@nestjs/bull";

import { ChatService } from "./chat.service";
import { CommonService } from "@common/services/common.service";
import { UploadService } from "@upload/services/upload.service";
import { Chats } from "../models/chat.model";
import { Users } from "@user/models/user.model";
import { Files } from "@upload/models/files.model";

describe("ChatService", () => {
  let service: ChatService;

  const mockQueue = {
    add: jest.fn(),
  };

  const mockCommonService = {
    validateMongoID: jest.fn(),
    validateArryByMongoIDs: jest.fn(),
  };

  const mockUploadService = {
    deleteFile: jest.fn(),
  };

  const mockChatModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findById: jest.fn(),
  };

  const mockChatsConnection = {
    createCollection: jest.fn(),
    model: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: "ChatsConnection",
          useValue: mockChatsConnection,
        },
        {
          provide: getModelToken(Chats.name, "Datas"),
          useValue: mockChatModel,
        },
        {
          provide: getModelToken(Users.name, "Datas"),
          useValue: {},
        },
        {
          provide: getModelToken(Files.name, "Datas"),
          useValue: {},
        },
        {
          provide: getQueueToken("chat.process"),
          useValue: mockQueue,
        },
        {
          provide: CommonService,
          useValue: mockCommonService,
        },
        {
          provide: getConnectionToken("ChatsConnection"),
          useValue: mockChatsConnection,
        },
        {
          provide: UploadService,
          useValue: mockUploadService,
        },
      ],
    }).compile();

    service = module.get(ChatService);
  });

  describe("createChat", () => {
    it("retorna chat exist", async () => {
      const chat = {
        populate: jest.fn().mockResolvedValue("chat-populated"),
      };

      mockChatModel.findOne.mockResolvedValue(chat);

      const result = await service.createChat(["1", "2"]);

      expect(result).toBe("chat-populated");
    });

    it("create new chat", async () => {
      const chat = {
        _id: { toString: () => "123" },
        populate: jest.fn().mockResolvedValue("new-chat"),
      };

      mockChatModel.findOne.mockResolvedValue(null);
      mockChatModel.create.mockResolvedValue(chat);

      const result = await service.createChat(["1", "2"]);

      expect(mockChatsConnection.createCollection).toHaveBeenCalledWith(
        "ChatMessage_123",
      );
      expect(result).toBe("new-chat");
    });
  });

  describe("getChatsByUserId", () => {
    it("toThrow error if not chats", async () => {
      mockChatModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const userId = "507f1f77bcf86cd799439011";

      await expect(service.getChatsByUserId(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("addMessage", () => {
    it("toThrow error if message is void", async () => {
      await expect(
        service.addMessage("chat", {
          message: "",
          images: [],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("create message", async () => {
      const msg = {
        populate: jest.fn().mockResolvedValue(null),
      };

      const messageModel = {
        create: jest.fn().mockResolvedValue(msg),
      };

      (mockChatsConnection.model as jest.Mock).mockReturnValue(messageModel);

      mockChatModel.findByIdAndUpdate.mockResolvedValue(null);

      const result = await service.addMessage("chat", {
        message: "oi",
      } as any);

      expect(result).toBe(msg);
    });
  });

  describe("getMessages", () => {
    it("chatId invalid", async () => {
      mockCommonService.validateMongoID.mockReturnValue(false);

      await expect(service.getMessages("x", 1, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("not messages", async () => {
      mockCommonService.validateMongoID.mockReturnValue(true);

      const messageModel = {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([]),
        }),
        countDocuments: jest.fn().mockResolvedValue(0),
      };

      (mockChatsConnection.model as jest.Mock).mockReturnValue(messageModel);

      await expect(service.getMessages("1", 1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("return pages", async () => {
      mockCommonService.validateMongoID.mockReturnValue(true);

      const messageModel = {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([{ id: 1 }]),
        }),
        countDocuments: jest.fn().mockResolvedValue(1),
      };

      (mockChatsConnection.model as jest.Mock).mockReturnValue(messageModel);

      const result = await service.getMessages("1", 1, 10);

      expect(result.totalItems).toBe(1);
    });
  });

  describe("getChatByUsersIds", () => {
    it("chat not found", async () => {
      mockCommonService.validateMongoID.mockReturnValue(true);
      mockCommonService.validateArryByMongoIDs.mockReturnValue(true);

      mockChatModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.getChatByUsersIds(["1"])).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("deleteMessageById", () => {
    it("delete files", async () => {
      mockCommonService.validateMongoID.mockReturnValue(true);

      const messageModel = {
        findByIdAndDelete: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue({
            images: [{ _id: "1" }],
            file: { _id: "2" },
          }),
        }),
      };

      (mockChatsConnection.model as jest.Mock).mockReturnValue(messageModel);

      await service.deleteMessageById("chat", "msg");

      expect(mockUploadService.deleteFile).toHaveBeenCalledWith("1");
      expect(mockUploadService.deleteFile).toHaveBeenCalledWith("2");
    });
  });

  describe("deleteChatById", () => {
    it("chat not found", async () => {
      mockCommonService.validateMongoID.mockReturnValue(true);
      mockChatModel.findById.mockResolvedValue(null);

      await expect(service.deleteChatById("1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("send to queue", async () => {
      mockCommonService.validateMongoID.mockReturnValue(true);

      const chat = { id: "1" };
      mockChatModel.findById.mockResolvedValue(chat);

      await service.deleteChatById("1");

      expect(mockQueue.add).toHaveBeenCalledWith("chat.delete", chat);
    });
  });
});

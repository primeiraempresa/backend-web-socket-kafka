import { Test, TestingModule } from "@nestjs/testing";
import { ChatService } from "./chat.service";
import { getModelToken } from "@nestjs/mongoose";
import { getConnectionToken } from "@nestjs/mongoose";
import { CommonService } from "@common/services/common.service";
import { UploadService } from "@upload/services/upload.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Chats } from "../models/chat.model";
import mongoose from "mongoose";

describe("ChatService", () => {
  let service: ChatService;
  let chatModel: any;
  let connection: any;
  let queue: any;
  let commonService: any;
  let uploadService: any;

  beforeEach(async () => {
    chatModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndDelete: jest.fn(),
      find: jest.fn(),
    };

    connection = {
      createCollection: jest.fn(),
      model: jest.fn(),
    };

    queue = {
      add: jest.fn(),
    };

    commonService = {
      validateMongoID: jest.fn(),
      validateArryByMongoIDs: jest.fn(),
    };

    uploadService = {
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getModelToken(Chats.name), useValue: chatModel },
        { provide: getConnectionToken(), useValue: connection },
        { provide: "BullQueue_chat.process", useValue: queue },
        { provide: CommonService, useValue: commonService },
        { provide: UploadService, useValue: uploadService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  describe("createChat", () => {
    it("should return existing chat if found", async () => {
      const userIds = ["id1", "id2"];
      const mockChat = { _id: "chatId", populate: jest.fn().mockReturnThis() };
      jest
        .spyOn(service, "getChatByUsersIds")
        .mockResolvedValue(mockChat as any);

      const result = await service.createChat(userIds);
      expect(result).toBe(mockChat);
    });

    it("should create and return new chat if not found", async () => {
      const userIds = ["id1", "id2"];
      jest
        .spyOn(service, "getChatByUsersIds")
        .mockRejectedValue(new NotFoundException());
      const mockChat = {
        _id: { toString: () => "mockId" },
        populate: jest.fn().mockReturnValue("populatedChat"),
      };
      chatModel.create.mockResolvedValue(mockChat);

      const result = await service.createChat(userIds);
      expect(result).toBe("populatedChat");
    });
  });

  describe("addMessage", () => {
    it("should throw if no content provided", async () => {
      await expect(
        service.addMessage("chatId", {
          message: "",
          images: [],
          file: null,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should create and return message", async () => {
      const mockMessage = {
        populate: jest.fn().mockReturnThis(),
      };
      const messageModel = {
        create: jest.fn().mockResolvedValue(mockMessage),
      };
      connection.model.mockReturnValue(messageModel);

      const result = await service.addMessage("chatId", {
        message: "Hello",
      } as any);

      expect(result).toBe(mockMessage);
    });
  });

  describe("getChatsByUserId", () => {
    it("should return chats for the given user ID", async () => {
      const userId = "64c3c82ef395d95ee1122334";
      const expectedChats = [
        {
          _id: "chat1",
          chatters: [{ _id: userId }, { _id: "otherUser1" }],
          toObject: function () {
            return this;
          },
        },
        {
          _id: "chat2",
          chatters: [{ _id: userId }, { _id: "otherUser2" }],
          toObject: function () {
            return this;
          },
        },
      ];

      const execMock = jest.fn().mockResolvedValue(expectedChats);
      const populateMock = jest.fn().mockReturnValue({ exec: execMock });
      chatModel.find.mockReturnValue({ populate: populateMock });

      await service.getChatsByUserId(userId);

      expect(chatModel.find).toHaveBeenCalledWith({
        chatters: { $in: [new mongoose.Types.ObjectId(userId)] },
      });
      expect(populateMock).toHaveBeenCalledWith("chatters");
    });

    it("should throw NotFoundException if no chats are found", async () => {
      const userId = "64c3c82ef395d95ee1122334";

      const execMock = jest.fn().mockResolvedValue([]);
      const populateMock = jest.fn().mockReturnValue({ exec: execMock });
      chatModel.find.mockReturnValue({ populate: populateMock });

      await expect(service.getChatsByUserId(userId)).rejects.toThrow(
        new NotFoundException(["no chats found"]),
      );
    });
  });

  describe("getMessages", () => {
    it("should return paginated messages", async () => {
      const chatId = "validChatId";
      commonService.validateMongoID.mockReturnValue(true);
      const messageModel = {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([{ message: "msg" }]),
        }),
        countDocuments: jest.fn().mockResolvedValue(1),
      };
      connection.model.mockReturnValue(messageModel);

      const result = await service.getMessages(chatId, 1, 1);
      expect(result.items.length).toBe(1);
      expect(result.totalItems).toBe(1);
    });

    it("should throw NotFoundException if no messages", async () => {
      commonService.validateMongoID.mockReturnValue(true);
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
      connection.model.mockReturnValue(messageModel);

      await expect(service.getMessages("chatId", 1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getChatByUsersIds", () => {
    it("should throw for invalid id", async () => {
      commonService.validateMongoID.mockReturnValue(false);
      await expect(
        service.getChatByUsersIds(undefined, "badId"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should return chat if found", async () => {
      const mockChat = { _id: "id" };
      commonService.validateArryByMongoIDs.mockReturnValue(true);
      chatModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue(mockChat),
      });

      const result = await service.getChatByUsersIds(["id1", "id2"]);
      expect(result).toBe(mockChat);
    });

    it("should throw if chat not found", async () => {
      commonService.validateArryByMongoIDs.mockReturnValue(true);
      chatModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue(null),
      });

      await expect(service.getChatByUsersIds(["id1", "id2"])).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getMessageById", () => {
    it("should return message if found", async () => {
      commonService.validateMongoID.mockReturnValue(true);
      const messageModel = {
        findOne: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnThis(),
        }),
      };
      connection.model.mockReturnValue(messageModel);

      await expect(
        service.getMessageById("chatId", "msgId"),
      ).resolves.not.toBeNull();
    });
  });

  describe("updateMessageById", () => {
    it("should update and return message", async () => {
      commonService.validateMongoID.mockReturnValue(true);

      const mockFound = {
        images: [{ _id: "img1" }],
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ images: [{ _id: "img1" }] }),
      };
      const mockUpdated = {
        _id: "msgId",
        sender: {},
        images: [],
        file: null,
      };
      const mockUpdatedChain = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUpdated),
      };

      // 🛠️ Model com mocks corretos
      const messageModel = {
        findById: jest.fn().mockReturnValue(mockFound),
        findByIdAndUpdate: jest.fn().mockReturnValue(mockUpdatedChain),
      };
      connection.model.mockReturnValue(messageModel as any);

      const result = await service.updateMessageById("chatId", "msgId", {
        images: [],
      } as any);

      expect(messageModel.findById).toHaveBeenCalledWith("msgId");
      expect(messageModel.findByIdAndUpdate).toHaveBeenCalled();
      expect(result).toBe(mockUpdated);
    });
  });

  describe("deleteMessageById", () => {
    it("should delete message and call file deletion", async () => {
      commonService.validateMongoID.mockReturnValue(true);

      // 🛠️ Modelo corrigido com chain populate().exec()
      const mockDeleted = {
        images: [{ _id: "img1" }],
        file: { _id: "file1" },
      };
      const mockDeletedChain = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDeleted),
      };
      const messageModel = {
        findByIdAndDelete: jest.fn().mockReturnValue(mockDeletedChain),
      };
      connection.model.mockReturnValue(messageModel as any);

      const result = await service.deleteMessageById("chatId", "msgId");

      expect(uploadService.deleteFile).toHaveBeenCalledWith("img1");
      expect(uploadService.deleteFile).toHaveBeenCalledWith("file1");
      expect(result).toBe(mockDeleted);
    });

    it("should throw NotFoundException if message not found", async () => {
      commonService.validateMongoID.mockReturnValue(true);

      const nullChain = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      const messageModel = {
        findByIdAndDelete: jest.fn().mockReturnValue(nullChain),
      };
      connection.model.mockReturnValue(messageModel as any);

      await expect(
        service.deleteMessageById("chatId", "msgId"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("deleteChatById", () => {
    it("should throw for invalid id", async () => {
      commonService.validateMongoID.mockReturnValue(false);
      await expect(service.deleteChatById("badId")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should enqueue chat deletion job", async () => {
      commonService.validateMongoID.mockReturnValue(true);
      const mockChat = { _id: "chatId" };
      chatModel.findById.mockResolvedValue(mockChat);

      await service.deleteChatById("chatId");
      expect(queue.add).toHaveBeenCalledWith("chat.delete", mockChat);
    });

    it("should throw if chat not found", async () => {
      commonService.validateMongoID.mockReturnValue(true);
      chatModel.findById.mockResolvedValue(null);

      await expect(service.deleteChatById("chatId")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

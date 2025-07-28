import { Test, TestingModule } from "@nestjs/testing";
import { ChatService } from "./chat.service";
import { getModelToken } from "@nestjs/mongoose";
import { getConnectionToken } from "@nestjs/mongoose";
import { CommonService } from "@common/services/common.service";
import { UploadService } from "@upload/services/upload.service";
import { Queue } from "bull";
import { getQueueToken } from "@nestjs/bull";
import { Chats } from "../models/chat.model";
import { BadRequestException, NotFoundException } from "@nestjs/common";

describe("ChatService", () => {
  let service: ChatService;
  let queue: Queue;

  const mockChatModel = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    populate: jest.fn(),
    exec: jest.fn(),
  };

  const mockConnection = {
    model: jest.fn(),
    createCollection: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  const mockCommonService = {
    validateMongoID: jest.fn().mockReturnValue(true),
    validateArryByMongoIDs: jest.fn().mockReturnValue(true),
  };

  const mockUploadService = {
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getModelToken(Chats.name), useValue: mockChatModel },
        { provide: getConnectionToken(), useValue: mockConnection },
        { provide: getQueueToken("chat.process"), useValue: mockQueue },
        { provide: CommonService, useValue: mockCommonService },
        { provide: UploadService, useValue: mockUploadService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    queue = module.get<Queue>(getQueueToken("chat.process"));
  });

  describe("createChat", () => {
    it("should return existing chat if it exists", async () => {
      jest
        .spyOn(service, "getChatByUsersIds")
        .mockResolvedValueOnce({ _id: "123" } as any);
      const result = await service.createChat(["user1", "user2"]);
      expect(result).toEqual({ _id: "123" });
    });

    it("should create a new chat if it does not exist", async () => {
      jest
        .spyOn(service, "getChatByUsersIds")
        .mockRejectedValueOnce(new NotFoundException());
      mockChatModel.create.mockResolvedValueOnce({
        _id: "123",
        populate: jest
          .fn()
          .mockResolvedValue({ _id: "123", chatters: ["user1", "user2"] }),
      });

      mockConnection.createCollection.mockResolvedValueOnce(undefined);

      const result = await service.createChat(["user1", "user2"]);
      expect(result).toEqual({ _id: "123", chatters: ["user1", "user2"] });
    });
  });

  describe("getChatsByUserId", () => {
    const validUserId = "507f191e810c19729de860ea";

    it("should return formatted chats", async () => {
      const chat = {
        chatters: [{ _id: validUserId }, { _id: "507f191e810c19729de860eb" }],
        toObject: () => ({
          chatters: [{ _id: validUserId }, { _id: "507f191e810c19729de860eb" }],
        }),
      };

      mockChatModel.find.mockReturnValue({
        populate: () => ({
          populate: () => ({
            exec: () => Promise.resolve([chat]),
          }),
        }),
      });

      const result = (await service.getChatsByUserId(validUserId)) as any;
      expect(result[0].chatters[0]._id).toBe("507f191e810c19729de860eb");
    });

    it("should throw NotFoundException if no chats found", async () => {
      mockChatModel.find.mockReturnValue({
        populate: () => ({
          populate: () => ({
            exec: () => Promise.resolve([]),
          }),
        }),
      });

      await expect(service.getChatsByUserId(validUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("addMessage", () => {
    it("should throw BadRequest if no content provided", async () => {
      await expect(service.addMessage("chatId", {} as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should create a new message", async () => {
      const modelMock = {
        create: jest.fn().mockResolvedValue({
          populate: jest.fn().mockResolvedValue({}),
        }),
      };

      mockConnection.model.mockReturnValue(modelMock as any);
      mockChatModel.findByIdAndUpdate.mockResolvedValue(undefined);

      await service.addMessage("chatId", {
        message: "hello",
      } as any);
      expect(modelMock.create).toHaveBeenCalled();
    });
  });

  describe("getMessages", () => {
    it("should return paginated messages", async () => {
      const modelMock = {
        find: () => ({
          sort: () => ({
            skip: () => ({
              limit: () => ({
                populate: () => ({
                  populate: () => ({
                    populate: () => ({
                      exec: () => Promise.resolve([{}]),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
        countDocuments: () => Promise.resolve(1),
      };

      mockConnection.model.mockReturnValue(modelMock as any);

      const result = await service.getMessages("chatId", 1, 10);
      expect(result.items.length).toBeGreaterThan(0);
    });

    it("should throw NotFoundException if no messages", async () => {
      const modelMock = {
        find: () => ({
          sort: () => ({
            skip: () => ({
              limit: () => ({
                populate: () => ({
                  populate: () => ({
                    populate: () => ({
                      exec: () => Promise.resolve([]),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
        countDocuments: () => Promise.resolve(0),
      };

      mockConnection.model.mockReturnValue(modelMock as any);

      await expect(service.getMessages("chatId", 1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getChatByUsersIds", () => {
    it("should return chat if found", async () => {
      mockChatModel.findOne.mockReturnValue({
        populate: () => ({
          populate: () => ({
            exec: () => Promise.resolve({ _id: "chat1" }),
          }),
        }),
      });

      const result = await service.getChatByUsersIds(["user1", "user2"]);
      expect(result._id).toBe("chat1");
    });

    it("should throw NotFoundException if not found", async () => {
      mockChatModel.findOne.mockReturnValue({
        populate: () => ({
          populate: () => ({
            exec: () => Promise.resolve(null),
          }),
        }),
      });

      await expect(service.getChatByUsersIds(["user1"])).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("deleteChatById", () => {
    it("should add deletion job to queue", async () => {
      mockChatModel.findById.mockResolvedValueOnce({ _id: "chatId" });
      mockQueue.add.mockResolvedValueOnce({ jobId: "12345" }); // mock do retorno

      const result = await service.deleteChatById("chatId");
      expect(queue.add).toHaveBeenCalledWith("chat.delete", { _id: "chatId" });
      expect(result).toBeDefined();
    });

    it("should throw if chat not found", async () => {
      mockChatModel.findById.mockResolvedValueOnce(null);
      await expect(service.deleteChatById("invalid")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

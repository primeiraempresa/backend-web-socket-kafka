import { Test, TestingModule } from "@nestjs/testing";
import { getConnectionToken, getModelToken } from "@nestjs/mongoose";

import { ChatProcessorService } from "./chat.processor.service";
import { ChatService } from "@chat/services/chat.service";
import { UploadService } from "@upload/services/upload.service";
import { Chats } from "@chat/models/chat.model";
import { getQueueToken } from "@nestjs/bull";

describe("ChatProcessorService", () => {
  let service: ChatProcessorService;

  const mockConnection = {
    dropCollection: jest.fn(),
  };

  const mockChatModel = {
    findByIdAndDelete: jest.fn(),
  };

  const mockChatService = {
    getMessages: jest.fn(),
  };

  const mockUploadService = {
    deleteFile: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  const mockJob = (data: any) => ({
    data,
    log: jest.fn(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatProcessorService,
        {
          provide: getConnectionToken("ChatsConnection"),
          useValue: mockConnection,
        },
        {
          provide: getModelToken(Chats.name, "Datas"),
          useValue: mockChatModel,
        },
        {
          provide: ChatService,
          useValue: mockChatService,
        },
        {
          provide: UploadService,
          useValue: mockUploadService,
        },
        {
          provide: getQueueToken("chat.process"),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<ChatProcessorService>(ChatProcessorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("chatDelete", () => {
    it("should delete chat and enqueue file deletions from messages", async () => {
      const chatId = "507f1f77bcf86cd799439011";
      const job = mockJob({ _id: chatId });

      mockChatService.getMessages
        .mockResolvedValueOnce({
          items: [
            {
              images: [{ _id: "img1" }],
              file: { _id: "file1" },
            },
          ],
          nextPage: 2,
        })
        .mockResolvedValueOnce({
          items: [],
          nextPage: null,
        });

      const result = await service.chatDelete(job as any);

      expect(result).toBe("chat deleted successfully");

      expect(mockChatService.getMessages).toHaveBeenCalledWith(
        chatId,
        1,
        expect.any(Number),
      );

      expect(mockChatService.getMessages).toHaveBeenCalledWith(
        chatId,
        2,
        expect.any(Number),
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        "file.delete",
        expect.objectContaining({
          files: {
            images: [{ _id: "img1" }],
            file: { _id: "file1" },
          },
          job,
        }),
      );

      expect(mockConnection.dropCollection).toHaveBeenCalledWith(
        `ChatMessage_${chatId}`,
      );

      expect(mockChatModel.findByIdAndDelete).toHaveBeenCalledWith(chatId);
    });
  });

  describe("deleteFile", () => {
    it("should delete all images and file successfully", async () => {
      const job = mockJob({
        files: {
          images: [{ _id: "img1" }, { _id: "img2" }],
          file: { _id: "file1" },
        },
        job: {},
      });

      mockUploadService.deleteFile.mockResolvedValue(undefined);

      await service.deleteFile(job as any);

      expect(mockUploadService.deleteFile).toHaveBeenCalledTimes(3);
      expect(mockUploadService.deleteFile).toHaveBeenCalledWith("img1");
      expect(mockUploadService.deleteFile).toHaveBeenCalledWith("img2");
      expect(mockUploadService.deleteFile).toHaveBeenCalledWith("file1");

      expect(job.log).not.toHaveBeenCalled();
    });

    it("should handle error when deleting an image", async () => {
      const error = new Error("fail to delete");

      const job = mockJob({
        files: {
          images: [{ _id: "img1" }],
          file: undefined,
        },
        job: {},
      });

      mockUploadService.deleteFile.mockRejectedValueOnce(error);

      await service.deleteFile(job as any);

      expect(mockUploadService.deleteFile).toHaveBeenCalledWith("img1");

      expect(job.log).toHaveBeenCalledWith(
        expect.stringContaining("Erro ao deletar imagem img1"),
      );
    });

    it("should handle error when deleting a file", async () => {
      const error = new Error("fail to delete file");

      const job = mockJob({
        files: {
          images: undefined,
          file: { _id: "file1" },
        },
        job: {},
      });

      mockUploadService.deleteFile.mockRejectedValueOnce(error);

      await service.deleteFile(job as any);

      expect(mockUploadService.deleteFile).toHaveBeenCalledWith("file1");

      expect(job.log).toHaveBeenCalledWith(
        expect.stringContaining("Erro ao deletar imagem file1"),
      );
    });
  });
});

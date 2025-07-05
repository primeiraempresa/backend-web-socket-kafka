import { Test, TestingModule } from "@nestjs/testing";
import { ChatProcessorService } from "./chat.processor.service";
import { ChatService } from "@chat/services/chat.service";
import { UploadService } from "@upload/services/upload.service";
import { getConnectionToken, getModelToken } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import { Logger } from "@nestjs/common";

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
  const mockJob = (data) => ({
    data,
    log: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatProcessorService,
        {
          provide: Connection,
          useValue: mockConnection,
        },
        {
          provide: getModelToken("Chats"),
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
          provide: "bull_queue_chat.process",
          useValue: mockQueue,
        },
        {
          provide: getConnectionToken(),
          useValue: mockConnection,
        },
        {
          provide: "BullQueue_chat.process",
          useValue: mockQueue,
        },
        Logger,
      ],
    }).compile();

    service = module.get<ChatProcessorService>(ChatProcessorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("chatDelete", () => {
    it("should delete chat and associated files", async () => {
      const chatId = "chat123";
      const job = mockJob({ _id: chatId });
      mockChatService.getMessages
        .mockResolvedValueOnce({
          items: [{ images: [{ _id: "img1" }], file: { _id: "file1" } }],
          nextPage: true,
        })
        .mockResolvedValueOnce({
          items: [],
          nextPage: false,
        });

      await expect(service.chatDelete(job as any)).resolves.toBe(
        "chat deleted successfully",
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
    it("should delete images and files successfully", async () => {
      const filesData = {
        images: [{ _id: "img1" }, { _id: "img2" }],
        file: { _id: "file1" },
      };
      const job = mockJob({ files: filesData, job: {} });

      mockUploadService.deleteFile.mockResolvedValue(undefined);

      await service.deleteFile(job as any);

      expect(mockUploadService.deleteFile).toHaveBeenCalledTimes(3);
      expect(mockUploadService.deleteFile).toHaveBeenCalledWith("img1");
      expect(mockUploadService.deleteFile).toHaveBeenCalledWith("img2");
      expect(mockUploadService.deleteFile).toHaveBeenCalledWith("file1");
      expect(job.log).not.toHaveBeenCalled();
    });

    it("should handle errors when deleting images", async () => {
      const error = new Error("fail to delete");

      const filesData = {
        images: [{ _id: "img1" }],
        file: undefined,
      };
      const job = mockJob({ files: filesData, job: {} });

      mockUploadService.deleteFile.mockRejectedValueOnce(error);

      const loggerErrorSpy = jest.spyOn(service["logger"], "error");

      await service.deleteFile(job as any);

      expect(mockUploadService.deleteFile).toHaveBeenCalledWith("img1");
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `Erro ao deletar imagem img1:`,
        error,
      );
      expect(job.log).toHaveBeenCalledWith(
        `Erro ao deletar imagem img1:${error}`,
      );
    });

    it("should handle errors when deleting file", async () => {
      const error = new Error("fail to delete file");

      const filesData = {
        images: undefined,
        file: { _id: "file1" },
      };
      const job = mockJob({ files: filesData, job: {} });

      mockUploadService.deleteFile.mockRejectedValueOnce(error);

      const loggerErrorSpy = jest.spyOn(service["logger"], "error");

      await service.deleteFile(job as any);

      expect(mockUploadService.deleteFile).toHaveBeenCalledWith("file1");
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `Erro ao deletar imagem file1:`,
        error,
      );
      expect(job.log).toHaveBeenCalledWith(
        `Erro ao deletar imagem file1: ${error}`,
      );
    });
  });
});

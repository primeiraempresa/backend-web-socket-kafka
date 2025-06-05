import { Test, TestingModule } from "@nestjs/testing";
import { UploadService } from "@upload/services/upload.service";
import { WebSocketService } from "@common/services/webSocket.service";
import { FilesDocument } from "@upload/schemas/files.schema";
import { UploadConsumerController } from "./upload.consumer.controller";
jest.mock("file-type", () => ({
  fileTypeFromBuffer: jest
    .fn()
    .mockResolvedValue({ ext: "png", mime: "image/png" }),
}));
describe("UploadConsumerController", () => {
  let controller: UploadConsumerController;
  let uploadService: UploadService;
  let webSocketService: WebSocketService;

  const uploadServiceMock = {
    upload: jest.fn(),
    deleteFile: jest.fn(),
  };

  const webSocketServiceMock = {
    sendToUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadConsumerController],
      providers: [
        { provide: UploadService, useValue: uploadServiceMock },
        { provide: WebSocketService, useValue: webSocketServiceMock },
      ],
    }).compile();

    controller = module.get<UploadConsumerController>(UploadConsumerController);
    uploadService = module.get<UploadService>(UploadService);
    webSocketService = module.get<WebSocketService>(WebSocketService);

    jest.clearAllMocks();
  });

  describe("handleUploadCreate", () => {
    const message = {
      userId: "user123",
      bucket: "test-bucket",
      file: "base64string",
    };

    it("should upload file and send success message via websocket", async () => {
      const uploadedFile = { _id: "file123" } as FilesDocument;

      uploadService.upload = jest.fn().mockResolvedValue(uploadedFile);
      webSocketService.sendToUser = jest.fn();

      await controller.handleUploadCreate(message);

      expect(uploadService.upload).toHaveBeenCalledWith(
        message.bucket,
        message.file,
      );

      expect(webSocketService.sendToUser).toHaveBeenCalledWith(
        message.userId,
        "upload.create",
        uploadedFile,
      );
    });

    it("should handle error and send error message via websocket", async () => {
      const error = {
        response: { response: "Upload error" },
      };

      uploadService.upload = jest.fn().mockRejectedValue(error);
      webSocketService.sendToUser = jest.fn();

      await controller.handleUploadCreate(message);

      expect(webSocketService.sendToUser).toHaveBeenCalledWith(
        message.userId,
        "error",
        "Upload error",
      );
    });
  });

  describe("handleUploadDelete", () => {
    const message = {
      userId: "user123",
      id: "file123",
    };

    it("should delete file and send success message via websocket", async () => {
      uploadService.deleteFile = jest.fn().mockResolvedValue("File deleted");
      webSocketService.sendToUser = jest.fn();

      await controller.handleUploadDelete(message);

      expect(uploadService.deleteFile).toHaveBeenCalledWith(message.id);

      expect(webSocketService.sendToUser).toHaveBeenCalledWith(
        message.userId,
        "upload.delete",
        { message: "File deleted" },
      );
    });

    it("should handle error and send error message via websocket", async () => {
      const error = {
        response: { response: "Delete error" },
      };

      uploadService.deleteFile = jest.fn().mockRejectedValue(error);
      webSocketService.sendToUser = jest.fn();

      await controller.handleUploadDelete(message);

      expect(webSocketService.sendToUser).toHaveBeenCalledWith(
        message.userId,
        "error",
        "Delete error",
      );
    });
  });
});

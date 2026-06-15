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
      jest.spyOn(uploadService, "upload").mockResolvedValue(uploadedFile);

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
      const error = { response: { response: "Upload error" } };
      jest.spyOn(uploadService, "upload").mockRejectedValue(error);

      await controller.handleUploadCreate(message);

      expect(webSocketService.sendToUser).toHaveBeenCalledWith(
        message.userId,
        "error",
        "Upload error",
      );
    });

    it("should send raw error when error.response.response is not available", async () => {
      const error = new Error("Raw upload error");
      jest.spyOn(uploadService, "upload").mockRejectedValue(error);

      await controller.handleUploadCreate(message);

      expect(webSocketService.sendToUser).toHaveBeenCalledWith(
        message.userId,
        "error",
        error,
      );
    });
  });

  describe("handleUploadDelete", () => {
    const message = {
      userId: "user123",
      id: "file123",
    };

    it("should delete file and send success message via websocket", async () => {
      jest.spyOn(uploadService, "deleteFile").mockResolvedValue("File deleted");

      await controller.handleUploadDelete(message);

      expect(uploadService.deleteFile).toHaveBeenCalledWith(message.id);
      expect(webSocketService.sendToUser).toHaveBeenCalledWith(
        message.userId,
        "upload.delete",
        { message: "File deleted" },
      );
    });

    it("should handle error and send error message via websocket", async () => {
      const error = { response: { response: "Delete error" } };
      jest.spyOn(uploadService, "deleteFile").mockRejectedValue(error);

      await controller.handleUploadDelete(message);

      expect(webSocketService.sendToUser).toHaveBeenCalledWith(
        message.userId,
        "error",
        "Delete error",
      );
    });

    it("should send raw error when error.response.response is not available", async () => {
      const error = new Error("Raw delete error");
      jest.spyOn(uploadService, "deleteFile").mockRejectedValue(error);

      await controller.handleUploadDelete(message);

      expect(webSocketService.sendToUser).toHaveBeenCalledWith(
        message.userId,
        "error",
        error,
      );
    });
  });

  describe("handleUploadDeleteProcess", () => {
    it("should delete images when message.images is provided", async () => {
      const message = {
        images: [
          { _id: "image1" },
          { _id: "image2" },
          { _id: "image3" },
        ] as unknown as ReturnType<FilesDocument["toJSON"]>[],
      };
      jest.spyOn(uploadService, "deleteFile").mockResolvedValue("File deleted");

      await controller.handleUploadDeleteProcess(message);

      expect(uploadService.deleteFile).toHaveBeenCalledTimes(3);
      expect(uploadService.deleteFile).toHaveBeenCalledWith("image1");
      expect(uploadService.deleteFile).toHaveBeenCalledWith("image2");
      expect(uploadService.deleteFile).toHaveBeenCalledWith("image3");
    });

    it("should log error when image deletion fails", async () => {
      const message = {
        images: [{ _id: "image1" }, { _id: "image2" }] as unknown as ReturnType<
          FilesDocument["toJSON"]
        >[],
      };
      jest
        .spyOn(uploadService, "deleteFile")
        .mockRejectedValue(new Error("Delete failed"));
      jest.spyOn(controller["logger"], "error").mockImplementation();

      await controller.handleUploadDeleteProcess(message);

      expect(controller["logger"].error).toHaveBeenCalledTimes(2);
    });

    it("should delete single file when message.file is provided", async () => {
      const message = {
        file: {
          _id: "file1",
        } as unknown as ReturnType<FilesDocument["toJSON"]>,
      };
      jest.spyOn(uploadService, "deleteFile").mockResolvedValue("File deleted");

      await controller.handleUploadDeleteProcess(message);

      expect(uploadService.deleteFile).toHaveBeenCalledWith("file1");
    });

    it("should log error when single file deletion fails", async () => {
      const message = {
        file: {
          _id: "file1",
        } as unknown as ReturnType<FilesDocument["toJSON"]>,
      };
      jest
        .spyOn(uploadService, "deleteFile")
        .mockRejectedValue(new Error("Delete failed"));
      jest.spyOn(controller["logger"], "error").mockImplementation();

      await controller.handleUploadDeleteProcess(message);

      expect(controller["logger"].error).toHaveBeenCalledTimes(1);
    });

    it("should not call deleteFile when message is empty", async () => {
      await controller.handleUploadDeleteProcess({});

      expect(uploadService.deleteFile).not.toHaveBeenCalled();
    });
  });
});

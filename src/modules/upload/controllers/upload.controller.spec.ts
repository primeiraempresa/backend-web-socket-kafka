import { Test, TestingModule } from "@nestjs/testing";
import { UploadController } from "./upload.controller";
import { UploadService } from "../services/upload.service";
import { NotFoundException } from "@nestjs/common";

describe("UploadController", () => {
  let controller: UploadController;
  let service: UploadService;

  const mockUploadService = {
    CreateType: jest.fn(),
    GetTypes: jest.fn(),
    deleteType: jest.fn(),
    searchFile: jest.fn(),
    getFileAll: jest.fn(),
    getFileByID: jest.fn(),
    deleteFile: jest.fn(),
    upload: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        {
          provide: UploadService,
          useValue: mockUploadService,
        },
      ],
    }).compile();

    controller = module.get<UploadController>(UploadController);
    service = module.get<UploadService>(UploadService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("PostTypes", () => {
    it("should call CreateType with the correct value", async () => {
      mockUploadService.CreateType.mockResolvedValue({ type: "image/png" });
      const result = await controller.PostTypes({ type: "image/png" });
      expect(service.CreateType).toHaveBeenCalledWith("image/png");
      expect(result).toEqual({ type: "image/png" });
    });
  });

  describe("GetTypes", () => {
    it("should return list of types", async () => {
      mockUploadService.GetTypes.mockResolvedValue(["image/png"]);
      const result = await controller.GetTypes();
      expect(result).toEqual(["image/png"]);
    });
  });

  describe("DeleteTypes", () => {
    it("should call deleteType with correct param", async () => {
      mockUploadService.deleteType.mockResolvedValue("type deleted");
      const result = await controller.DeleteTypes("image/png");
      expect(service.deleteType).toHaveBeenCalledWith("image/png");
      expect(result).toBe("type deleted");
    });
  });

  describe("searchFile", () => {
    it("should call searchFile with all optional query params", async () => {
      const query = {
        bucket: "b",
        fieldname: "f",
        originalname: "o",
        key: "k",
        location: "l",
        contentType: "c",
        mimetype: "m",
      };
      const expected = [{ id: "123", bucket: "b" }];
      mockUploadService.searchFile.mockResolvedValue(expected);

      const result = await controller.searchFile(
        query.bucket,
        query.fieldname,
        query.originalname,
        query.key,
        query.location,
        query.contentType,
        query.mimetype,
      );

      expect(service.searchFile).toHaveBeenCalledWith(
        "b",
        "f",
        "o",
        "k",
        "l",
        "c",
        "m",
      );
      expect(result).toEqual(expected);
    });
  });

  describe("GetUsers (getFileAll)", () => {
    it("should return paginated files", async () => {
      const expected = {
        items: [{ id: "file1" }],
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        nextPage: null,
      };
      mockUploadService.getFileAll.mockResolvedValue(expected);

      const result = await controller.GetUsers(1, 10);
      expect(service.getFileAll).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(expected);
    });
  });

  describe("GetFile", () => {
    it("should return a file by ID", async () => {
      const expected = { id: "file123" };
      mockUploadService.getFileByID.mockResolvedValue(expected);
      const result = await controller.GetFile("file123");
      expect(service.getFileByID).toHaveBeenCalledWith("file123");
      expect(result).toEqual(expected);
    });

    it("should throw if file not found", async () => {
      mockUploadService.getFileByID.mockRejectedValue(
        new NotFoundException("File not found"),
      );
      await expect(controller.GetFile("invalid")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("DeleteFile", () => {
    it("should delete file by ID", async () => {
      mockUploadService.deleteFile.mockResolvedValue("File deleted");
      const result = await controller.DeleteFile("file123");
      expect(service.deleteFile).toHaveBeenCalledWith("file123");
      expect(result).toBe("File deleted");
    });
  });

  describe("upload", () => {
    it("should NOT call upload service because method is not implemented", async () => {
      const file = { location: "http://localhost/file.jpg" } as any;
      const result = await controller.upload(file, "my-bucket");
      expect(result).toBeUndefined();
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { UploadService } from "./upload.service";
import { getModelToken } from "@nestjs/mongoose";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Model } from "mongoose";
import { Allowed_file_typesDocument } from "../schemas/allowed_file_types.schema";
import { FilesDocument } from "../schemas/files.schema";

const mockAllowedFileTypes = [
  { type: "image/png" },
  { type: "application/pdf" },
];

const mockFileDoc = {
  _id: "fileId123",
  bucket: "test-bucket",
  key: "test-key",
  location: "http://localhost/test-key",
  save: jest.fn(),
};

describe("UploadService", () => {
  let service: UploadService;
  let allowedFileTypesModel: Model<Allowed_file_typesDocument>;
  let filesModel: Model<FilesDocument>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: getModelToken("Allowed_file_types"),
          useValue: {
            find: jest.fn().mockResolvedValue(mockAllowedFileTypes),
            findOne: jest.fn(),
            create: jest.fn(),
            deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
          },
        },
        {
          provide: getModelToken("Files"),
          useValue: {
            create: jest.fn().mockResolvedValue(mockFileDoc),
            findById: jest.fn().mockResolvedValue(mockFileDoc),
            findByIdAndDelete: jest.fn().mockResolvedValue(mockFileDoc),
            find: jest.fn().mockResolvedValue([mockFileDoc]),
            countDocuments: jest.fn().mockResolvedValue(1),
          },
        },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
    allowedFileTypesModel = module.get<Model<Allowed_file_typesDocument>>(
      getModelToken("Allowed_file_types"),
    );
    filesModel = module.get<Model<FilesDocument>>(getModelToken("Files"));
  });

  describe("GetTypes", () => {
    it("should return array of types", async () => {
      const result = await service.GetTypes();
      expect(result).toEqual(["image/png", "application/pdf"]);
    });

    it("should throw NotFoundException if no types found", async () => {
      jest.spyOn(allowedFileTypesModel, "find").mockResolvedValueOnce([]);
      await expect(service.GetTypes()).rejects.toThrow(NotFoundException);
    });
  });

  describe("CreateType", () => {
    it("should create new type if not exists", async () => {
      jest.spyOn(service, "typeExist").mockResolvedValue(false);
      const createMock = jest
        .spyOn(allowedFileTypesModel, "create")
        .mockResolvedValueOnce({ type: "text/csv" } as any);

      const result = await service.CreateType("text/csv");
      expect(createMock).toHaveBeenCalledWith({ type: "text/csv" });
      expect(result).toEqual({ type: "text/csv" });
    });

    it("should throw error if type exists", async () => {
      jest
        .spyOn(service, "typeExist")
        .mockRejectedValue(new BadRequestException("type already exists"));

      await expect(service.CreateType("image/png")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("deleteType", () => {
    it("should delete type successfully", async () => {
      const result = await service.deleteType("image/png");
      expect(result).toBe("type deleted");
    });

    it("should throw NotFoundException if type not found", async () => {
      jest
        .spyOn(allowedFileTypesModel, "deleteOne")
        .mockResolvedValueOnce({ deletedCount: 0, acknowledged: true });
      await expect(service.deleteType("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("upload", () => {
    it("should replace URL and save file", async () => {
      const file = {
        location: "http://minio-backend-app-marcelo/test-key",
      } as any;

      const result = await service.upload(file);
      expect(result.location).toContain("localhost");
    });
  });

  describe("getFileByID", () => {
    it("should return file if exists", async () => {
      const result = await service.getFileByID("fileId123");
      expect(result).toEqual(mockFileDoc);
    });

    it("should throw NotFoundException if file not found", async () => {
      jest.spyOn(filesModel, "findById").mockResolvedValueOnce(null);
      await expect(service.getFileByID("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

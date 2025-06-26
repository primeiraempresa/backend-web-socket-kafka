import { Test, TestingModule } from "@nestjs/testing";
import { UploadService } from "./upload.service";
import { getModelToken } from "@nestjs/mongoose";
import { Files } from "../models/files.model";
import { AllowedFileTypes } from "../models/allowed_file_types.model";
import { CommonService } from "@common/services/common.service";
import {
  BadRequestException,
  NotAcceptableException,
  NotFoundException,
} from "@nestjs/common";
import * as fileType from "file-type";

jest.mock("file-type", () => ({
  fromBuffer: jest.fn(),
}));

(fileType.fromBuffer as jest.Mock).mockResolvedValue({
  mime: "image/png",
  ext: "png",
});
jest.mock("@config/s3.config", () => ({
  s3: {
    send: jest.fn(),
  },
}));

jest.mock("@config/configService", () => ({
  configService: {
    get: jest.fn((key: string) => {
      const values = {
        REGIONAWS: "us-east-1",
        ENV_AMB: "PROD",
      };
      return values[key];
    }),
  },
}));

describe("UploadService", () => {
  let service: UploadService;
  let allowedFileTypesModel: any;
  let filesModel: any;
  let commonService: any;

  beforeEach(async () => {
    allowedFileTypesModel = {
      find: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      deleteOne: jest.fn(),
    };

    filesModel = {
      find: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn(),
      findByIdAndDelete: jest.fn(),
      findOne: jest.fn(),
    };

    commonService = {
      isBase64: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: getModelToken(AllowedFileTypes.name),
          useValue: allowedFileTypesModel,
        },
        {
          provide: getModelToken(Files.name),
          useValue: filesModel,
        },
        {
          provide: CommonService,
          useValue: commonService,
        },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
  });

  describe("GetTypes", () => {
    it("should return types", async () => {
      allowedFileTypesModel.find.mockResolvedValue([{ type: "image/png" }]);
      const result = await service.GetTypes();
      expect(result).toEqual(["image/png"]);
    });

    it("should throw NotFoundException if no types found", async () => {
      allowedFileTypesModel.find.mockResolvedValue([]);
      await expect(service.GetTypes()).rejects.toThrow(NotFoundException);
    });
  });

  describe("CreateType", () => {
    it("should create a new type", async () => {
      allowedFileTypesModel.findOne.mockResolvedValue(null);
      allowedFileTypesModel.create.mockResolvedValue({ type: "image/png" });

      const result = await service.CreateType("image/png");
      expect(result).toEqual({ type: "image/png" });
    });

    it("should throw if type already exists", async () => {
      allowedFileTypesModel.findOne.mockResolvedValue({ type: "image/png" });

      await expect(service.CreateType("image/png")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("deleteType", () => {
    it("should delete type", async () => {
      allowedFileTypesModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await service.deleteType("image/png");
      expect(result).toBe("type deleted");
    });

    it("should throw if type not found", async () => {
      allowedFileTypesModel.deleteOne.mockResolvedValue({ deletedCount: 0 });

      await expect(service.deleteType("image/png")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("upload", () => {
    it("should upload file successfully", async () => {
      commonService.isBase64.mockReturnValue(true);
      allowedFileTypesModel.find.mockResolvedValue([{ type: "image/png" }]);

      const sendMock = require("@config/s3.config").s3.send;
      sendMock.mockResolvedValue({});

      filesModel.create.mockResolvedValue({ _id: "1", key: "file.png" });

      const result = await service.upload(
        "test-bucket",
        Buffer.from("fake").toString("base64"),
      );

      expect(result).toEqual({ _id: "1", key: "file.png" });
    });

    it("should throw if file is not base64", async () => {
      commonService.isBase64.mockReturnValue(false);

      await expect(service.upload("bucket", "notbase64")).rejects.toThrow(
        NotAcceptableException,
      );
    });

    it("should throw if bucket is missing", async () => {
      commonService.isBase64.mockReturnValue(true);

      await expect(service.upload("", "base64string")).rejects.toThrow(Error);
    });

    it("should throw if content type is invalid", async () => {
      commonService.isBase64.mockReturnValue(true);
      allowedFileTypesModel.find.mockResolvedValue([{ type: "image/jpeg" }]);

      await expect(
        service.upload("bucket", Buffer.from("fake").toString("base64")),
      ).rejects.toThrow(NotAcceptableException);
    });
  });

  describe("getFileAll", () => {
    it("should return paginated files", async () => {
      filesModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ id: "1" }]),
      });

      filesModel.countDocuments.mockResolvedValue(1);

      const result = await service.getFileAll(1, 10);

      expect(result.items.length).toBe(1);
      expect(result.totalItems).toBe(1);
    });

    it("should throw if no files", async () => {
      filesModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      filesModel.countDocuments.mockResolvedValue(0);

      await expect(service.getFileAll(1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getFileByID", () => {
    it("should return file", async () => {
      filesModel.findOne.mockResolvedValue({ id: "1" });

      const result = await service.getFileByID("1");
      expect(result).toEqual({ id: "1" });
    });

    it("should throw if not found", async () => {
      filesModel.findOne.mockResolvedValue(null);

      await expect(service.getFileByID("1")).rejects.toThrow(NotFoundException);
    });
  });

  describe("searchFile", () => {
    it("should return matching files", async () => {
      filesModel.find.mockResolvedValue([{ id: "1" }]);

      const result = await service.searchFile("bucket");
      expect(result).toEqual([{ id: "1" }]);
    });

    it("should throw if no criteria provided", async () => {
      await expect(service.searchFile()).rejects.toThrow(BadRequestException);
    });

    it("should throw if no files found", async () => {
      filesModel.find.mockResolvedValue([]);

      await expect(service.searchFile("bucket")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("deleteFile", () => {
    it("should delete file", async () => {
      const sendMock = require("@config/s3.config").s3.send;
      sendMock.mockResolvedValue({});

      filesModel.findByIdAndDelete.mockResolvedValue({
        bucket: "bucket",
        key: "file.png",
      });

      const result = await service.deleteFile("id");

      expect(result).toBe("File deleted");
    });

    it("should throw if file not found", async () => {
      filesModel.findByIdAndDelete.mockResolvedValue(null);

      await expect(service.deleteFile("id")).rejects.toThrow(NotFoundException);
    });
  });
});

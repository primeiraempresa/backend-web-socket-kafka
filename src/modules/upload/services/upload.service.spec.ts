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

jest.mock("@config/s3.config", () => ({
  s3: {
    send: jest.fn(),
  },
}));

jest.mock("@config/config.service", () => ({
  configService: {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        REGIONAWS: "us-east-1",
        ENV_AMB: "PROD",
      };
      return values[key];
    }),
  },
}));

Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: () => "uuid-mock",
  },
  configurable: true,
});

describe("UploadService", () => {
  let service: UploadService;
  let allowedFileTypesModel: any;
  let filesModel: any;
  let commonService: any;
  let s3SendMock: jest.Mock;
  let configGetMock: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    (fileType.fromBuffer as jest.Mock).mockResolvedValue({
      mime: "image/png",
      ext: "png",
    });

    s3SendMock = require("@config/s3.config").s3.send as jest.Mock;
    configGetMock = require("@config/config.service").configService
      .get as jest.Mock;

    configGetMock.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        REGIONAWS: "us-east-1",
        ENV_AMB: "PROD",
      };
      return values[key];
    });

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
          provide: getModelToken(AllowedFileTypes.name, "Datas"),
          useValue: allowedFileTypesModel,
        },
        {
          provide: getModelToken(Files.name, "Datas"),
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
      expect(allowedFileTypesModel.create).toHaveBeenCalledWith({
        type: "image/png",
      });
    });

    it("should throw if type already exists", async () => {
      allowedFileTypesModel.findOne.mockResolvedValue({ type: "image/png" });
      await expect(service.CreateType("image/png")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("getType", () => {
    it("should return the type if found", async () => {
      allowedFileTypesModel.findOne.mockResolvedValue({ type: "image/png" });
      const result = await service.getType("image/png");
      expect(result).toEqual({ type: "image/png" });
    });

    it("should return null if not found", async () => {
      allowedFileTypesModel.findOne.mockResolvedValue(null);
      const result = await service.getType("image/png");
      expect(result).toBeNull();
    });
  });

  describe("typeExist", () => {
    it("should return false if type does not exist", async () => {
      allowedFileTypesModel.findOne.mockResolvedValue(null);
      const result = await service.typeExist("image/png");
      expect(result).toBe(false);
    });

    it("should throw BadRequestException if type exists", async () => {
      allowedFileTypesModel.findOne.mockResolvedValue({ type: "image/png" });
      await expect(service.typeExist("image/png")).rejects.toThrow(
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
    it("should upload file successfully when bucket already exists", async () => {
      commonService.isBase64.mockReturnValue(true);
      allowedFileTypesModel.find.mockResolvedValue([{ type: "image/png" }]);
      s3SendMock.mockResolvedValue({});
      filesModel.create.mockResolvedValue({ _id: "1", key: "file.png" });

      const result = await service.upload(
        "test-bucket",
        Buffer.from("fake").toString("base64"),
      );

      expect(result).toEqual({ _id: "1", key: "file.png" });
      expect(s3SendMock).toHaveBeenCalled();
      expect(filesModel.create).toHaveBeenCalled();
    });

    it("should create bucket if it does not exist and then upload", async () => {
      commonService.isBase64.mockReturnValue(true);
      allowedFileTypesModel.find.mockResolvedValue([{ type: "image/png" }]);
      s3SendMock
        .mockRejectedValueOnce({ name: "NotFound" })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      filesModel.create.mockResolvedValue({ _id: "2", key: "file2.png" });

      const result = await service.upload(
        "new-bucket",
        Buffer.from("fake").toString("base64"),
      );

      expect(result).toEqual({ _id: "2", key: "file2.png" });
      expect(s3SendMock).toHaveBeenCalledTimes(4);
    });

    it("should create bucket when HeadBucket fails with 404", async () => {
      commonService.isBase64.mockReturnValue(true);
      allowedFileTypesModel.find.mockResolvedValue([{ type: "image/png" }]);
      s3SendMock
        .mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      filesModel.create.mockResolvedValue({ _id: "3", key: "file3.png" });

      const result = await service.upload(
        "bucket-404",
        Buffer.from("fake").toString("base64"),
      );

      expect(result).toEqual({ _id: "3", key: "file3.png" });
    });

    it("should throw NotAcceptableException if HeadBucket fails with other error", async () => {
      commonService.isBase64.mockReturnValue(true);
      allowedFileTypesModel.find.mockResolvedValue([{ type: "image/png" }]);
      s3SendMock.mockRejectedValueOnce({
        name: "Forbidden",
        $metadata: { httpStatusCode: 403 },
      });

      await expect(
        service.upload("bucket", Buffer.from("fake").toString("base64")),
      ).rejects.toThrow(NotAcceptableException);
    });

    it("should throw if file is not base64", async () => {
      commonService.isBase64.mockReturnValue(false);
      await expect(service.upload("bucket", "notbase64")).rejects.toThrow(
        NotAcceptableException,
      );
    });

    it("should throw if bucket is missing", async () => {
      commonService.isBase64.mockReturnValue(true);
      await expect(service.upload("", "base64string")).rejects.toThrow(
        NotAcceptableException,
      );
    });

    it("should throw if content type is invalid", async () => {
      commonService.isBase64.mockReturnValue(true);
      allowedFileTypesModel.find.mockResolvedValue([{ type: "image/jpeg" }]);

      await expect(
        service.upload("bucket", Buffer.from("fake").toString("base64")),
      ).rejects.toThrow(NotAcceptableException);
    });

    it("should build LOCAL location url when ENV_AMB is LOCAL", async () => {
      configGetMock.mockImplementation((key: string) => {
        const values: Record<string, string> = {
          REGIONAWS: "us-east-1",
          ENV_AMB: "LOCAL",
        };
        return values[key];
      });
      commonService.isBase64.mockReturnValue(true);
      allowedFileTypesModel.find.mockResolvedValue([{ type: "image/png" }]);
      s3SendMock.mockResolvedValue({});
      filesModel.create.mockImplementation((info) => Promise.resolve(info));

      const result: any = await service.upload(
        "local-bucket",
        Buffer.from("fake").toString("base64"),
      );

      expect(result.location).toContain("http://localhost:9000/local-bucket/");
    });

    it("should build PROD (S3) location url when ENV_AMB is not LOCAL", async () => {
      commonService.isBase64.mockReturnValue(true);
      allowedFileTypesModel.find.mockResolvedValue([{ type: "image/png" }]);
      s3SendMock.mockResolvedValue({});
      filesModel.create.mockImplementation((info) => Promise.resolve(info));

      const result: any = await service.upload(
        "prod-bucket",
        Buffer.from("fake").toString("base64"),
      );

      expect(result.location).toContain(
        "https://prod-bucket.s3.us-east-1.amazonaws.com/",
      );
    });

    it("should use provided originalname/acl when given", async () => {
      commonService.isBase64.mockReturnValue(true);
      allowedFileTypesModel.find.mockResolvedValue([{ type: "image/png" }]);

      const result = await (service as any).generateImageInfoFromBase64(
        Buffer.from("fake").toString("base64"),
        {
          fieldname: "file",
          originalname: "custom-name.png",
          bucket: "b",
          acl: "private",
        },
      );

      expect(result.originalname).toBe("custom-name.png");
      expect(result.acl).toBe("private");
    });
  });

  describe("getFileAll", () => {
    it("should return paginated files with nextPage", async () => {
      filesModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ id: "1" }]),
      });
      filesModel.countDocuments.mockResolvedValue(30);

      const result = await service.getFileAll(1, 10);

      expect(result.items.length).toBe(1);
      expect(result.totalItems).toBe(30);
      expect(result.totalPages).toBe(3);
      expect(result.currentPage).toBe(1);
      expect(result.nextPage).toBe(2);
    });

    it("should return nextPage null on last page", async () => {
      filesModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ id: "1" }]),
      });
      filesModel.countDocuments.mockResolvedValue(10);

      const result = await service.getFileAll(1, 10);
      expect(result.nextPage).toBeNull();
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
    it("should return matching files by bucket", async () => {
      filesModel.find.mockResolvedValue([{ id: "1" }]);
      const result = await service.searchFile("bucket");
      expect(result).toEqual([{ id: "1" }]);
    });

    it("should accept all search fields combined", async () => {
      filesModel.find.mockResolvedValue([{ id: "1" }]);
      const result = await service.searchFile(
        "bucket",
        "file",
        "original.png",
        "key.png",
        "http://loc",
        "image/png",
        "image/png",
      );
      expect(result).toEqual([{ id: "1" }]);
      expect(filesModel.find).toHaveBeenCalledWith({
        $or: [
          { bucket: "bucket" },
          { fieldname: "file" },
          { originalname: "original.png" },
          { key: "key.png" },
          { location: "http://loc" },
          { contentType: "image/png" },
          { mimetype: "image/png" },
        ],
      });
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

    it("should throw if files result is null", async () => {
      filesModel.find.mockResolvedValue(null);
      await expect(service.searchFile("bucket")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("deleteFile", () => {
    it("should delete file", async () => {
      s3SendMock.mockResolvedValue({});
      filesModel.findByIdAndDelete.mockResolvedValue({
        bucket: "bucket",
        key: "file.png",
      });

      const result = await service.deleteFile("id");
      expect(result).toBe("File deleted");
      expect(s3SendMock).toHaveBeenCalled();
    });

    it("should throw if file not found", async () => {
      filesModel.findByIdAndDelete.mockResolvedValue(null);
      await expect(service.deleteFile("id")).rejects.toThrow(NotFoundException);
    });

    it("should propagate S3 error when DeleteObject fails", async () => {
      filesModel.findByIdAndDelete.mockResolvedValue({
        bucket: "bucket",
        key: "file.png",
      });
      const s3Error = new Error("S3 down");
      s3SendMock.mockRejectedValue(s3Error);

      await expect(service.deleteFile("id")).rejects.toThrow("S3 down");
    });
  });
});

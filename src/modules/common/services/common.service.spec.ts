import { Test, TestingModule } from "@nestjs/testing";
import { CommonService } from "./common.service";

describe("CommonService", () => {
  let service: CommonService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommonService],
    }).compile();

    service = module.get<CommonService>(CommonService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
  describe("validateMongoID()", () => {
    it("should return true when provided with a valid MongoDB ObjectId string", () => {
      const validObjectId = "507f1f77bcf86cd799439011";
      const result = service.validateMongoID(validObjectId);
      expect(result).toBe(true);
    });
    it("should return false when provided with null input", () => {
      const result = service.validateMongoID(null as unknown as string);
      expect(result).toBe(false);
    });
  });
  describe("validateArryByMongoIDs()", () => {
    it("should return true when all strings in the array are valid MongoDB ObjectIDs", () => {
      const validIds = [
        "507f1f77bcf86cd799439011",
        "507f191e810c19729de860ea",
        "5e4dc74f3d06b6a922ca5534",
      ];
      const result = service.validateArryByMongoIDs(validIds);
      expect(result).toBe(true);
    });
    it("should return false when input is not an array", () => {
      const invalidInput = "not an array" as unknown as string[];
      const result = service.validateArryByMongoIDs(invalidInput);
      expect(result).toBe(false);
    });
  });
  describe("isBase64()", () => {
    it("should return true for a valid base64 string", () => {
      const str = btoa("Hello World");
      expect(service.isBase64(str)).toBe(true);
    });

    it("should return false for string with invalid characters", () => {
      const str = "##@@invalid$$";
      expect(service.isBase64(str)).toBe(false);
    });

    it("should return false for string with invalid length (not multiple of 4)", () => {
      const str = "abcd1";
      expect(service.isBase64(str)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(service.isBase64("")).toBe(false);
    });
  });
});

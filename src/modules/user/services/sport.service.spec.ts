import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { NotFoundException } from "@nestjs/common";
import { SportService } from "./sport.service";
import { Sports } from "@user/models/sports.model";
import { CacheService } from "@common/services/cache.service";

describe("SportService", () => {
  let service: SportService;

  const mockSportModel = {
    find: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  };

  const mockCacheService = {
    getFromCache: jest.fn(),
    setToCache: jest.fn(),
    deleteFromCache: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SportService,
        {
          provide: getModelToken(Sports.name, "Datas"),
          useValue: mockSportModel,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<SportService>(SportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getSports", () => {
    it("should return data from cache if exists", async () => {
      const cacheData = [{ name: "Soccer" }];
      mockCacheService.getFromCache.mockResolvedValue(cacheData);

      const result = await service.getSports();

      expect(result).toBe(cacheData);
      expect(mockCacheService.getFromCache).toHaveBeenCalled();
      expect(mockSportModel.find).not.toHaveBeenCalled();
    });

    it("should fetch from database and cache when cache is empty", async () => {
      const dbData = [{ name: "Tennis" }];

      mockCacheService.getFromCache.mockResolvedValue(null);
      mockSportModel.find.mockResolvedValue(dbData);

      const result = await service.getSports();

      expect(result).toBe(dbData);
      expect(mockSportModel.find).toHaveBeenCalled();
      expect(mockCacheService.setToCache).toHaveBeenCalledWith(
        "allSportsCache",
        dbData,
      );
    });

    it("should throw NotFoundException if database returns null", async () => {
      mockCacheService.getFromCache.mockResolvedValue(null);
      mockSportModel.find.mockResolvedValue(null);

      await expect(service.getSports()).rejects.toThrow(NotFoundException);
    });
  });

  describe("createSports", () => {
    it("should delete cache and create a sport", async () => {
      const sport = { name: "Basketball" } as Sports;
      const created = { id: "1", ...sport };

      mockSportModel.create.mockResolvedValue(created);

      const result = await service.createSports(sport);

      expect(mockCacheService.deleteFromCache).toHaveBeenCalledWith(
        "allSportsCache",
      );
      expect(mockSportModel.create).toHaveBeenCalledWith(sport);
      expect(result).toBe(created);
    });
  });

  describe("updateSport", () => {
    it("should update and return the sport", async () => {
      const id = "1";
      const body = { name: "Updated" };
      const updated = { id, ...body };

      mockSportModel.findByIdAndUpdate.mockResolvedValue(updated);

      const result = await service.updateSport(id, body);

      expect(mockCacheService.deleteFromCache).toHaveBeenCalledWith(
        "allSportsCache",
      );
      expect(mockSportModel.findByIdAndUpdate).toHaveBeenCalledWith(id, body, {
        new: true,
        runValidators: true,
      });
      expect(result).toBe(updated);
    });

    it("should throw NotFoundException if sport not found", async () => {
      mockSportModel.findByIdAndUpdate.mockResolvedValue(null);

      await expect(service.updateSport("1", { name: "Test" })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("deleteSport", () => {
    it("should delete and return the sport", async () => {
      const deleted = { id: "1", name: "Soccer" };

      mockSportModel.findByIdAndDelete.mockResolvedValue(deleted);

      const result = await service.deleteSport("1");

      expect(mockCacheService.deleteFromCache).toHaveBeenCalledWith(
        "allSportsCache",
      );
      expect(mockSportModel.findByIdAndDelete).toHaveBeenCalledWith("1");
      expect(result).toBe(deleted);
    });

    it("should throw NotFoundException if sport not found", async () => {
      mockSportModel.findByIdAndDelete.mockResolvedValue(null);

      await expect(service.deleteSport("1")).rejects.toThrow(NotFoundException);
    });
  });
});

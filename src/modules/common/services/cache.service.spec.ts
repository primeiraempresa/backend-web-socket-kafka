import { Test, TestingModule } from "@nestjs/testing";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { CacheService } from "./cache.service";
import { Cache } from "cache-manager";

describe("CacheService", () => {
  let service: CacheService;
  let mockCacheManager: jest.Mocked<Cache>;

  beforeEach(async () => {
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      // outros métodos que o Cache pode ter
    } as unknown as jest.Mocked<Cache>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  describe("getFromCache", () => {
    it("should return value from cache", async () => {
      const key = "test-key";
      const expectedValue = { data: "test" };
      mockCacheManager.get.mockResolvedValue(expectedValue);

      const result = await service.getFromCache<typeof expectedValue>(key);

      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
      expect(result).toEqual(expectedValue);
    });

    it("should return null if cache is empty", async () => {
      const key = "empty-key";
      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.getFromCache<any>(key);

      expect(result).toBeNull();
    });
  });

  describe("setToCache", () => {
    it("should set value to cache and return it", async () => {
      const key = "new-key";
      const value = { name: "cache-item" };

      mockCacheManager.set.mockResolvedValue(value);

      const result = await service.setToCache<typeof value>(key, value);

      expect(mockCacheManager.set).toHaveBeenCalledWith(key, value);
      expect(result).toEqual(value);
    });
  });

  describe("deleteFromCache", () => {
    it("should delete key from cache and return true", async () => {
      const key = "delete-key";

      mockCacheManager.del.mockResolvedValue(true);

      const result = await service.deleteFromCache(key);

      expect(mockCacheManager.del).toHaveBeenCalledWith(key);
      expect(result).toBe(true);
    });

    it("should return false if key was not deleted", async () => {
      const key = "non-existent-key";

      mockCacheManager.del.mockResolvedValue(false);

      const result = await service.deleteFromCache(key);

      expect(result).toBe(false);
    });
  });
});

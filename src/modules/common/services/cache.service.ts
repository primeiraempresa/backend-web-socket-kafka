import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable } from "@nestjs/common";
import { Cache } from "cache-manager";
@Injectable()
export class CacheService {
  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}
  async getFromCache<T>(key: string): Promise<T | null> {
    return await this.cacheManager.get<T>(key);
  }

  async setToCache<T>(key: string, value: T): Promise<T> {
    return await this.cacheManager.set(key, value);
  }

  async deleteFromCache<T>(key: string): Promise<boolean> {
    return await this.cacheManager.del(key);
  }
}

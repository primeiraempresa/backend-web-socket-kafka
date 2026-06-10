import { CacheService } from "@common/services/cache.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { SportDTO } from "@user/dto/sport.dto";
import { Sports } from "@user/models/sports.model";
import { SportsDocument } from "@user/schemas/sports.schema";
import { Model } from "mongoose";

@Injectable()
export class SportService {
  constructor(
    @InjectModel(Sports.name, "Datas")
    private readonly sportModel: Model<SportsDocument>,

    private readonly cacheService: CacheService,
  ) {}

  private allSportsCache = "allSportsCache";

  async getSports() {
    const findCache: SportsDocument[] | null =
      await this.cacheService.getFromCache(this.allSportsCache);
    if (!findCache) {
      const find = await this.sportModel.find();
      if (!find) {
        throw new NotFoundException(["sports not found"]);
      }
      await this.cacheService.setToCache<SportsDocument[]>(
        this.allSportsCache,
        find,
      );
      return find;
    }
    return findCache;
  }

  async createSports(sport: Sports) {
    await this.cacheService.deleteFromCache(this.allSportsCache);
    return await this.sportModel.create(sport);
  }

  async updateSport(id: string, sport: SportDTO) {
    await this.cacheService.deleteFromCache(this.allSportsCache);
    const find = await this.sportModel.findByIdAndUpdate(id, sport, {
      new: true,
      runValidators: true,
    });
    if (!find) {
      throw new NotFoundException(["sport not found"]);
    }
    return find;
  }

  async deleteSport(id: string) {
    await this.cacheService.deleteFromCache(this.allSportsCache);
    const delSport = await this.sportModel.findByIdAndDelete(id);
    if (!delSport) {
      throw new NotFoundException(["sport not found"]);
    }
    return delSport;
  }
}

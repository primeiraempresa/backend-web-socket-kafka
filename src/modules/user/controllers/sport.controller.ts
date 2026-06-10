import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiOAuth2, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SportDTO } from "@user/dto/sport.dto";
import { Sports } from "@user/models/sports.model";
import { SportService } from "@user/services/sport.service";

@Controller("sports")
@UseGuards(AuthGuard("jwt"))
@ApiOAuth2(["read", "write"], "oauth2")
@ApiTags("Sports")
export class SportsCotroller {
  constructor(private readonly sport_service: SportService) {}
  @Get()
  @ApiOperation({ summary: "get All Sports" })
  async getSports() {
    return await this.sport_service.getSports();
  }

  @Post()
  @ApiOperation({ summary: "create Sport" })
  async postSports(@Body() body: Sports) {
    return await this.sport_service.createSports(body);
  }

  @Put(":id")
  @ApiOperation({ summary: "update Sport" })
  async putSport(@Param("id") id: string, @Body() body: SportDTO) {
    return await this.sport_service.updateSport(id, body);
  }

  @Delete(":id")
  async deleteSport(@Param("id") id: string) {
    return await this.sport_service.deleteSport(id);
  }
}

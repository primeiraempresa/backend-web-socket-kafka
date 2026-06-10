import { Module } from "@nestjs/common";
import { UserController } from "./controllers/user.controller";
import { UserService } from "./services/user.service";
import { MongooseModule } from "@nestjs/mongoose";
import { Users } from "./models/user.model";
import { Users_schema } from "./schemas/user.schema";
import { UserGateway } from "./gateway/user.gateway";
import { CommonModule } from "@common/common.module";
import { Sports } from "./models/sports.model";
import { Sports_schema } from "./schemas/sports.schema";
import { SportsCotroller } from "./controllers/sport.controller";
import { SportService } from "./services/sport.service";

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: Users.name, schema: Users_schema, collection: Users.name },
        { name: Sports.name, schema: Sports_schema, collection: Sports.name },
      ],
      "Datas",
    ),
    CommonModule,
  ],
  controllers: [UserController, SportsCotroller],
  providers: [UserService, UserGateway, SportService],
  exports: [UserService],
})
export class UserModule {}

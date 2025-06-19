import { Module } from "@nestjs/common";
import { UserController } from "./controllers/user.controller";
import { UserService } from "./services/user.service";
import { MongooseModule } from "@nestjs/mongoose";
import { Users } from "./models/user.model";
import { Users_schema } from "./schemas/user.schema";
import { UserGateway } from "./gateway/user.gateway";
import { CommonModule } from "@common/common.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Users.name, schema: Users_schema, collection: Users.name },
    ]),
    CommonModule,
  ],
  controllers: [UserController],
  providers: [UserService, UserGateway],
  exports: [UserService],
})
export class UserModule {}

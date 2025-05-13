import { Module } from "@nestjs/common";
import { UserModule } from "./modules/user/user.module";
import { ConfigModule } from "@nestjs/config";
import { WinstonModule } from "nest-winston";
import winstonConfig from "@config/winston.config";
import { MongooseModule } from "@nestjs/mongoose";
import { configService } from "@config/configService";
import { CacheModule } from "@nestjs/cache-manager";
import { AuthModule } from "./modules/auth/auth.module";
import { JwtModule } from "@nestjs/jwt";
import { ChatModule } from "./modules/chat/chat.module";
import { CommonModule } from './modules/common/common.module';
import { ImageModule } from './modules/upload/image.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    MongooseModule.forRoot(
      configService.get<string>("DBAAS_MONGODB_ENDPOINT") || "",
    ),
    CacheModule.register({
      isGlobal: true,
    }),
    WinstonModule.forRoot(winstonConfig),
    JwtModule.register({
      global: true,
      secret: configService.get<string>("client_secret"),
      signOptions: { expiresIn: "48h" },
    }),
    UserModule,
    AuthModule,
    ChatModule,
    CommonModule,
    ImageModule,
  ],
})
export class AppModule {}

import { Module } from "@nestjs/common";
import { UserModule } from "./modules/user/user.module";
import { ConfigModule } from "@nestjs/config";
import { WinstonModule } from "nest-winston";
import winstonConfig from "@config/winston.config";
import { MongooseModule } from "@nestjs/mongoose";
import { configService } from "@config/config.service";
import { CacheModule } from "@nestjs/cache-manager";
import { AuthModule } from "./modules/auth/auth.module";
import { JwtModule } from "@nestjs/jwt";
import { ChatModule } from "./modules/chat/chat.module";
import { CommonModule } from "./modules/common/common.module";
import { UploadModule } from "./modules/upload/upload.module";
import { BullModule } from "@nestjs/bull";
import { redisSentinelsConfig } from "@config/redis.sentinels.config";
import { redisStore } from "cache-manager-redis-store";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    MongooseModule.forRoot(
      `${configService.get<string>("DBAAS_MONGODB_ENDPOINT") as string}`,
      { connectionName: "Datas", dbName: "Datas" },
    ),
    MongooseModule.forRoot(
      `${configService.get<string>("DBAAS_MONGODB_ENDPOINT") as string}`,
      {
        connectionName: "ChatsConnection",
        dbName: "Chats_Messages",
      },
    ),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => ({
        store: redisStore,
        ...redisSentinelsConfig,
      }),
    }),
    WinstonModule.forRoot(winstonConfig),
    JwtModule.register({
      global: true,
      secret: configService.get<string>("client_secret"),
      signOptions: {
        expiresIn: configService.get<string>("EXPIRES_TOKEN") ?? "48h",
      },
    }),
    BullModule.forRoot({
      redis: redisSentinelsConfig,
    }),
    UserModule,
    AuthModule,
    ChatModule,
    CommonModule,
    UploadModule,
  ],
})
export class AppModule {}

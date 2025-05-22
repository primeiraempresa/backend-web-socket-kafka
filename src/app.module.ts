import { Inject, Module, OnModuleInit } from "@nestjs/common";
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
import { CommonModule } from "./modules/common/common.module";
import { UploadModule } from "./modules/upload/upload.module";
import { ClientKafka, ClientsModule, Transport } from "@nestjs/microservices";

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
    ClientsModule.register([
      {
        name: "KAFKA_SERVICE",
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: [configService.get<string>("KAFKA_BROKER") as string],
          },
          consumer: {
            groupId: configService.get<string>("KAFKA_GROUP_ID") as string,
          },
        },
      },
    ]),
    UserModule,
    AuthModule,
    ChatModule,
    CommonModule,
    UploadModule,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    @Inject("KAFKA_SERVICE") private readonly kafkaClient: ClientKafka,
  ) {}
  async onModuleInit() {
    await this.kafkaClient.connect();
  }
}

import { Module } from "@nestjs/common";
import { ChatController } from "./controllers/chat.controller";
import { ChatService } from "./services/chat.service";
import { MongooseModule } from "@nestjs/mongoose";
import { Chats } from "./models/chat.model";
import { Chat_schema } from "./schemas/chat.schema";
import { CommonModule } from "@common/common.module";
import { ChatConsumerController } from "./controllers/chat.consumer.controller";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { configService } from "@config/configService";
import { ChatProducerService } from "./services/chat.producer.service";
import { ChatGateway } from "./gateway/chat.gateway";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chats.name, schema: Chat_schema, collection: Chats.name },
    ]),
    ClientsModule.register([
      {
        name: "CHAT_MODULE",
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: [configService.get<string>("KAFKA_BROKER") as string],
            retry: {
              retries: 10,
              initialRetryTime: 3000,
            },
          },
          consumer: {
            groupId: configService.get<string>("KAFKA_GROUP_ID") as string,
            allowAutoTopicCreation: true,
          },
        },
      },
    ]),
    CommonModule,
  ],
  controllers: [ChatController, ChatConsumerController],
  providers: [ChatService, ChatProducerService, ChatGateway],
})
export class ChatModule {}

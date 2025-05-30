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
import { ChatWebSocketService } from "./services/chat-webSocket.service";
import { UserModule } from "@user/user.module";

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
    UserModule,
  ],
  controllers: [ChatController, ChatConsumerController],
  providers: [
    ChatService,
    ChatGateway,
    ChatWebSocketService,
    ChatProducerService,
    {
      provide: "ChatProducerService_createChat",
      useValue: ChatProducerService,
    },
    {
      provide: "ChatProducerService_createMessage",
      useValue: ChatProducerService,
    },
    {
      provide: "ChatProducerService_updateMessage",
      useValue: ChatProducerService,
    },
    {
      provide: "ChatProducerService_deleteMessage",
      useValue: ChatProducerService,
    },
    {
      provide: "ChatProducerService_deleteChat",
      useValue: ChatProducerService,
    },
  ],
})
export class ChatModule {}

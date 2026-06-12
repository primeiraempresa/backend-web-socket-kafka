import { Module } from "@nestjs/common";
import { ChatController } from "./controllers/chat.controller";
import { ChatService } from "./services/chat.service";
import { MongooseModule } from "@nestjs/mongoose";
import { Chats } from "./models/chat.model";
import { Chats_schema } from "./schemas/chat.schema";
import { CommonModule } from "@common/common.module";
import { ChatConsumerController } from "./controllers/chat.consumer.controller";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { configService } from "@config/config.service";
import { ChatProducerService } from "./services/chat.producer.service";
import { ChatGateway } from "./gateway/chat.gateway";
import { UserModule } from "@user/user.module";
import { BullModule } from "@nestjs/bull";
import { UploadModule } from "@upload/upload.module";
import { ChatProcessorService } from "./jobs/chat.processor.service";
import {
  ChatConversation,
  ChatConversationSchema,
} from "./models/chat_conversation.model";
import { Users } from "@user/models/user.model";
import { Users_schema } from "@user/schemas/user.schema";
import { Files } from "@upload/models/files.model";
import { FilesSchema } from "@upload/schemas/files.schema";
import { Sports } from "@user/models/sports.model";
import { Sports_schema } from "@user/schemas/sports.schema";
import { grupIDs } from "@common/utils/groupsID.util";

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: Chats.name, schema: Chats_schema, collection: Chats.name },
        {
          name: Users.name,
          schema: Users_schema,
        },
        {
          name: Files.name,
          schema: FilesSchema,
        },
        { name: Sports.name, schema: Sports_schema, collection: Sports.name },
      ],
      "Datas",
    ),
    MongooseModule.forFeature(
      [{ name: ChatConversation.name, schema: ChatConversationSchema }],
      "ChatsConnection",
    ),
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
            groupId: grupIDs,
            allowAutoTopicCreation: true,
          },
        },
      },
    ]),
    BullModule.registerQueue({
      name: "chat",
    }),
    BullModule.registerQueue({
      name: "chat.process",
    }),
    CommonModule,
    UserModule,
    UploadModule,
  ],
  controllers: [ChatController, ChatConsumerController],
  providers: [
    ChatService,
    ChatGateway,
    ChatProducerService,
    ChatProcessorService,
  ],
})
export class ChatModule {}

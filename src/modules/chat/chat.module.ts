import { Module } from "@nestjs/common";
import { ChatController } from "./controllers/chat/chat.controller";
import { ChatService } from "./services/chat.service";
import { MongooseModule } from "@nestjs/mongoose";
import { Chats } from "./models/chat.model";
import { Chat_schema } from "./schemas/chat.schema";
import { CommonModule } from "@common/common.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chats.name, schema: Chat_schema, collection: Chats.name },
    ]),
    CommonModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}

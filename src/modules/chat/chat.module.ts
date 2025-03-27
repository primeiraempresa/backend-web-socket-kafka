import { Module } from '@nestjs/common';
import { ChatController } from './controllers/chat/chat.controller';
import { ChatService } from './services/chat/chat.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService]
})
export class ChatModule {}

import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ClientKafka } from "@nestjs/microservices";

@Injectable()
export class ChatProducerService<T> implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject("CHAT_MODULE") private readonly client: ClientKafka) {}
  async onModuleInit() {
    this.client.subscribeToResponseOf("chat.create");
    this.client.subscribeToResponseOf("chat.delete");
    this.client.subscribeToResponseOf("chat.message.create");
    this.client.subscribeToResponseOf("chat.message.update");
    this.client.subscribeToResponseOf("chat.message.delete");
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  sendMessage(topic: string, message: T) {
    console.log(message);
    return this.client.emit(topic, message);
  }
}

import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ClientKafka } from "@nestjs/microservices";
import { Observable } from "rxjs";

@Injectable()
export class ChatProducerService implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject("CHAT_MODULE") private readonly client: ClientKafka) {}
  async onModuleInit() {
    this.client.subscribeToResponseOf("chat.create");
    this.client.subscribeToResponseOf("chat.delete");
    this.client.subscribeToResponseOf("chat.message.create");
    this.client.subscribeToResponseOf("chat.message.update");
    this.client.subscribeToResponseOf("chat.message.delete");
    this.client.subscribeToResponseOf("chat.message.create.pending");
    this.client.subscribeToResponseOf("chat.message.update.pending");
    this.client.subscribeToResponseOf("chat.message.delete.pending");
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  sendMessage<T>(topic: string, message: T): Observable<T> {
    return this.client.emit<T>(topic, message);
  }
}

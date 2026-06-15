import { SubscribeToResponseOffChats } from "@chat/utils/subscribeToResponsesOff.util";
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
    SubscribeToResponseOffChats.forEach((item: string) => {
      this.client.subscribeToResponseOf(item);
    });
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  sendMessage<T>(topic: string, message: T): Observable<T> {
    return this.client.emit<T>(topic, message);
  }
}

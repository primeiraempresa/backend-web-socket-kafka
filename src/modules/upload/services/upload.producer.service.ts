import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ClientKafka } from "@nestjs/microservices";

@Injectable()
export class UploadProducerService implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject("UPLOAD_MODULE") private readonly client: ClientKafka) {}
  async onModuleInit() {
    this.client.subscribeToResponseOf("type.create");
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  sendMessage(topic: string, message: any) {
    console.log(topic);
    return this.client.emit(topic, message);
  }
}

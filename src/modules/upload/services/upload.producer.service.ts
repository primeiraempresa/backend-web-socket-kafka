import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ClientKafka } from "@nestjs/microservices";
import { Observable } from "rxjs";

@Injectable()
export class UploadProducerService<T> implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject("UPLOAD_MODULE") private readonly client: ClientKafka) {}
  async onModuleInit() {
    this.client.subscribeToResponseOf("upload.create");
    this.client.subscribeToResponseOf("upload.delete");
    await this.client.connect();
  }
  async onModuleDestroy() {
    await this.client.close();
  }
  sendMessage(topic: string, message: T): Observable<T> {
    return this.client.emit<T>(topic, message);
  }
}

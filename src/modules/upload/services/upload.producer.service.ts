import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ClientKafka } from "@nestjs/microservices";
import { subscribeToResponseOfUpload } from "@upload/utils/subscribeToResponsesOff.util";
import { Observable } from "rxjs";

@Injectable()
export class UploadProducerService implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject("UPLOAD_MODULE") private readonly client: ClientKafka) {}
  async onModuleInit() {
    subscribeToResponseOfUpload.forEach((item: string) => {
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

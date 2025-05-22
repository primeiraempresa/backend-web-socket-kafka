import { Controller } from "@nestjs/common";
import {
  Ctx,
  KafkaContext,
  MessagePattern,
  Payload,
} from "@nestjs/microservices";
import { UploadService } from "@upload/services/upload.service";

@Controller()
export class UploadConsumerController {
  constructor(private readonly uploadService: UploadService) {}
  @MessagePattern("type.create.reply")
  async handleTextCreate(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const originalMessage = message.type.toString();
    console.log("Received:", originalMessage);

    console.log("Received from Kafka:", message);
    await this.uploadService.CreateType(originalMessage);
  }
}

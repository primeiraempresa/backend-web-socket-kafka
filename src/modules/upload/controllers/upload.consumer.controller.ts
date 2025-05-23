import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { Allowed_file_types } from "@upload/models/allowed_file_types.model";
import { UploadService } from "@upload/services/upload.service";

@Controller()
export class UploadConsumerController {
  constructor(private readonly uploadService: UploadService) {}
  @MessagePattern("type.create")
  async handleTextCreate(@Payload() message: Allowed_file_types) {
    console.log("Received:", message);
    console.log("Received from Kafka:", message);
    return await this.uploadService.CreateType(message.type);
  }
}

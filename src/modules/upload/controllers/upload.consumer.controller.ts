import { WebSocketService } from "@common/services/webSocket.service";
import { Controller, Logger } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { FilesDocument } from "@upload/schemas/files.schema";
import { UploadService } from "@upload/services/upload.service";

@Controller()
export class UploadConsumerController {
  constructor(
    private uploadService: UploadService,
    private readonly webSocketService: WebSocketService,
  ) {}
  private logger: Logger = new Logger(UploadConsumerController.name);
  @MessagePattern("upload.create")
  async handleUploadCreate(
    @Payload()
    message: {
      userId: string;
      bucket: string;
      file: Base64URLString;
    },
  ) {
    try {
      const upload: FilesDocument = await this.uploadService.upload(
        message.bucket,
        message.file,
      );
      return this.webSocketService.sendToUser(
        message.userId,
        "upload.create",
        upload,
      );
    } catch (error) {
      this.logger.error(error);
      return this.webSocketService.sendToUser(
        message.userId,
        "error",
        error?.response?.response || error,
      );
    }
  }
}

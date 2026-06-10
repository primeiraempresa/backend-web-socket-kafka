import { WebSocketService } from "@common/services/webSocket.service";
import { Controller, Logger } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { FilesDocument } from "@upload/schemas/files.schema";
import { UploadService } from "@upload/services/upload.service";

@Controller()
export class UploadConsumerController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly webSocketService: WebSocketService,
  ) {}
  private readonly logger: Logger = new Logger(UploadConsumerController.name);
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
    } catch (error: any) {
      this.logger.error(error);
      return this.webSocketService.sendToUser(
        message.userId,
        "error",
        error?.response?.response || error,
      );
    }
  }
  @MessagePattern("upload.delete")
  async handleUploadDelete(
    @Payload()
    message: {
      userId: string;
      id: string;
    },
  ) {
    try {
      const del = await this.uploadService.deleteFile(message.id);
      return this.webSocketService.sendToUser(message.userId, "upload.delete", {
        message: del,
      });
    } catch (error: any) {
      this.logger.error(error);
      return this.webSocketService.sendToUser(
        message.userId,
        "error",
        error?.response?.response || error,
      );
    }
  }
}

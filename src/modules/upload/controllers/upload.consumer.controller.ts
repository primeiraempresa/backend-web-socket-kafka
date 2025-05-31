import { Controller } from "@nestjs/common";
import { UploadService } from "@upload/services/upload.service";

@Controller()
export class UploadConsumerController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly,
  ) {}
}

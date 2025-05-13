import {
  Controller,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { configImage } from "../config/image.config";
import { ApiBody, ApiConsumes, ApiQuery } from "@nestjs/swagger";
import { IUploadedFile } from "@common/interface/UploadedFile.interface";
import multer from "multer";
import { multerS3Config } from "@config/multer.config";
import { UploadService } from "../services/upload.service";
import { DynamicMulterInterceptor } from "../interceptor/dynamic-multer.interceptor";
const allowedMimes: string[] = [
  "image/jpeg",
  "image/pjpeg",
  "image/png",
  "image/gif",
  "image/svg+xml",
];
@Controller("upload")
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}
  @Post()
  @ApiQuery({
    name: "bucket",
    required: false,
    type: String,
    description: "Bucket name",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    description: "Upload de imagem",
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @UseInterceptors(DynamicMulterInterceptor)
  upload(@UploadedFile() file: IUploadedFile) {
    return { file: file };
  }
}

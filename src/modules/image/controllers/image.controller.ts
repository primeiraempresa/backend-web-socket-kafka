import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { configImage } from "../config/image.config";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import { configService } from "@config/configService";
import { IUploadedFile } from "@common/interface/UploadedFile.interface";

@Controller("image")
export class ImageController {
  @UseInterceptors(FileInterceptor("file", configImage))
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
  @Post()
  async PostImage(@UploadedFile() file: IUploadedFile) {
    file.location = file.location.replace(
      "minio-backend-app-marcelo",
      "localhost",
    );

    return {
      file: file,
      message: "File uploaded successfully",
    };
  }
}

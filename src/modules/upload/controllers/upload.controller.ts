import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOAuth2,
  ApiOperation,
  ApiQuery,
} from "@nestjs/swagger";
import { IUploadedFile } from "@common/interface/UploadedFile.interface";
import { UploadService } from "../services/upload.service";
import { DynamicMulterInterceptor } from "../interceptor/dynamic-multer.interceptor";
import { Allowed_file_types } from "../models/allowed_file_types.models";
import { AuthGuard } from "@nestjs/passport";

@Controller("upload")
@UseGuards(AuthGuard("jwt"))
@ApiOAuth2(["read", "write"], "oauth2")
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}
  @Post("type")
  @ApiOperation({ summary: "register type of uploads" })
  async PostTypes(@Body() body: Allowed_file_types) {
    Logger.debug(body);
    return await this.uploadService.CreateType(body.type);
  }
  @Get("type")
  async GetTypes() {
    return await this.uploadService.GetTypes();
  }
  @Delete("type/:type")
  @ApiOperation({ summary: "delete type of uploads" })
  async DeleteTypes(@Param("type") type: string) {
    return await this.uploadService.deleteType(type);
  }
  @Get(":id")
  @ApiOperation({ summary: "get file by id" })
  async GetFile(@Param("id") id: string) {
  return await this.uploadService.getFile(id);
  }
  @Delete(":id")
  @ApiOperation({ summary: "delete file" })
  async DeleteFile(@Param("id") id: string) {
    return await this.uploadService.deleteFile(id);
  }
  @Post(":bucket")
  @UseInterceptors(DynamicMulterInterceptor)
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
  async upload(
    @UploadedFile() file: IUploadedFile,
    @Param("bucket") bucket: string,
  ) {}
}

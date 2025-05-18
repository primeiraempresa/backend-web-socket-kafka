import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
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
import { Allowed_file_types } from "../models/allowed_file_types.model";
import { AuthGuard } from "@nestjs/passport";

@Controller("upload")
@UseGuards(AuthGuard("jwt"))
@ApiOAuth2(["read", "write"], "oauth2")
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}
  @Post("type")
  @ApiOperation({ summary: "register type of uploads" })
  async PostTypes(@Body() body: Allowed_file_types) {
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

  @ApiQuery({
    name: "bucket",
    required: false,
    description: "Bucket name",
  })
  @ApiQuery({
    name: "fieldname",
    required: false,
    type: String,
    description: "Field name",
  })
  @ApiQuery({
    name: "originalname",
    required: false,
    type: String,
    description: "Original file name",
  })
  @ApiQuery({
    name: "key",
    required: false,
    type: String,
    description: "Key name",
  })
  @ApiQuery({
    name: "location",
    required: false,
    type: String,
    description: "Location",
  })
  @ApiQuery({
    name: "contentType",
    required: false,
    type: String,
    description: "Content type",
  })
  @ApiQuery({
    name: "mimetype",
    required: false,
    type: String,
    description: "Mimetype",
  })
  @ApiOperation({ summary: "search files" })
  @Get("search")
  async searchFile(
    @Query("bucket") bucket?: string,
    @Query("fieldname") fieldname?: string,
    @Query("originalname") originalname?: string,
    @Query("key") key?: string,
    @Query("location") location?: string,
    @Query("contentType") contentType?: string,
    @Query("mimetype") mimetype?: string,
  ) {
    return await this.uploadService.searchFile(
      bucket,
      fieldname,
      originalname,
      key,
      location,
      contentType,
      mimetype,
    );
  }

  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number for pagination",
  })
  @ApiQuery({
    name: "perPage",
    required: false,
    type: Number,
    description: "Number of items per page",
  })
  @Get()
  @ApiOperation({ summary: "list all Files" })
  async GetUsers(
    @Query("page") page?: number,
    @Query("perPage") perPage?: number,
  ) {
    return await this.uploadService.getFileAll(
      page ? parseInt(page.toString()) : 1,
      perPage ? parseInt(perPage.toString()) : 10,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "get file by id" })
  async GetFile(@Param("id") id: string) {
    return await this.uploadService.getFileByID(id);
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
  ) {
    file.bucket = bucket;
    return await this.uploadService.upload(file);
  }
}

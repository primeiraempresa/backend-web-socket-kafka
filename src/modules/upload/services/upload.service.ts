import { IUploadedFile } from "@common/interface/UploadedFile.interface";
import { multerS3Config } from "@config/multer.config";
import {
  HttpException,
  HttpStatus,
  Injectable,
  Req,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import multer from "multer";
import { configImage } from "../config/image.config";
const allowedMimes: string[] = [
  "image/jpeg",
  "image/pjpeg",
  "image/png",
  "image/gif",
  "image/svg+xml",
];
@Injectable()
export class UploadService {
  @UseInterceptors(
    FileInterceptor("file", multerS3Config("images", 10, allowedMimes)),
  )
  async upload(file: IUploadedFile, bucket?: string) {
    console.log(file)
    return {
      file,
    };
  }
}

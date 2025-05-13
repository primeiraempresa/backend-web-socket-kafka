// dynamic-multer.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import * as multer from "multer";
import { Request, Response } from "express";
import { Observable } from "rxjs";
import { multerS3Config } from "@config/multer.config";
import { HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import { s3 } from "@config/s3.config";

@Injectable()
export class DynamicMulterInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const bucket = req.params.bucket.toString();
    await this.ensureBucketExists(bucket);
    const allowedMimes = ["image/jpeg", "image/png"];

    return new Observable((observer) => {
      const upload = multer(multerS3Config(bucket, 10, allowedMimes)).single(
        "file",
      );

      upload(req, res, (err) => {
        if (err) {
          observer.error(err);
        } else {
          observer.next(req.file);
          observer.complete();
        }
      });
    });
  }
  async ensureBucketExists(bucketName: string): Promise<void> {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch (err: any) {
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
        await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
      } else {
        throw err;
      }
    }
  }
}

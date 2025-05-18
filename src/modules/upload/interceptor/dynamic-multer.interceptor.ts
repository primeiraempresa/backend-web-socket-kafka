import { ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import * as multer from "multer";
import { Request, Response } from "express";
import { Observable } from "rxjs";
import { multerS3Config } from "@config/multer.config";
import {
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";
import { s3 } from "@config/s3.config";
import { UploadService } from "../services/upload.service";
import { IUploadedFile } from "@common/interface/UploadedFile.interface";

@Injectable()
export class DynamicMulterInterceptor implements NestInterceptor {
  constructor(private readonly uploadService: UploadService) {}
  async intercept(context: ExecutionContext) {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const bucket = req.params.bucket.toString();
    await this.ensureBucketExists(bucket);
    const allowedMimes = await this.uploadService.GetTypes();

    return new Observable((observer) => {
      const upload = multer(multerS3Config(bucket, 10, allowedMimes)).single(
        "file",
      );

      upload(req, res, async (err) => {
        if (err) {
          return observer.error(err);
        }
        const file = await this.uploadService.upload(req.file as IUploadedFile);
        observer.next(file);
        return observer.complete();
      });
    });
  }
  private async ensureBucketExists(bucketName: string) {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch (err: any) {
      const isNotFound =
        err.name === "NotFound" || err.$metadata?.httpStatusCode === 404;

      if (isNotFound) {
        await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
        const publicPolicy = {
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "PublicReadGetObject",
              Effect: "Allow",
              Principal: "*",
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${bucketName}/*`],
            },
          ],
        };
        return await s3.send(
          new PutBucketPolicyCommand({
            Bucket: bucketName,
            Policy: JSON.stringify(publicPolicy),
          }),
        );
      }
      throw err;
    }
  }
}

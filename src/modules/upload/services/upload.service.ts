import {
  BadRequestException,
  Injectable,
  Logger,
  NotAcceptableException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { AllowedFileTypes } from "../models/allowed_file_types.model";
import { Model } from "mongoose";
import { Allowed_file_typesDocument } from "../schemas/allowed_file_types.schema";
import { Files } from "../models/files.model";
import { s3 } from "@config/s3.config";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { FilesDocument } from "../schemas/files.schema";
import { FilePagination } from "../models/file_pagination.model";
import * as fileType from "file-type";
import { configService } from "@config/config.service";
import { CommonService } from "@common/services/common.service";
@Injectable()
export class UploadService {
  constructor(
    @InjectModel(AllowedFileTypes.name)
    private readonly allowedFileTypesModel: Model<Allowed_file_typesDocument>,
    @InjectModel(Files.name)
    private readonly filesModel: Model<FilesDocument>,
    private readonly commonService: CommonService,
  ) {}
  private readonly logger = new Logger(UploadService.name);
  async GetTypes(): Promise<string[]> {
    const types = await this.allowedFileTypesModel.find();
    if (types.length == 0) {
      throw new NotFoundException(["No types found"]);
    }
    return types.map((type) => type.type);
  }
  async CreateType(type: string): Promise<Allowed_file_typesDocument> {
    await this.typeExist(type);
    return await this.allowedFileTypesModel.create({ type });
  }
  async getType(type: string): Promise<Allowed_file_typesDocument | null> {
    return await this.allowedFileTypesModel.findOne({ type });
  }
  async typeExist(type: string): Promise<boolean> {
    const file = await this.getType(type);
    if (file) {
      throw new BadRequestException(["type already exists"]);
    }
    return false;
  }
  async deleteType(type: string) {
    const findAndDelete = await this.allowedFileTypesModel.deleteOne({ type });
    if (!findAndDelete.deletedCount) {
      throw new NotFoundException(["type not found"]);
    }
    return "type deleted";
  }
  async getFileAll(page: number, limit: number): Promise<FilePagination> {
    const skip = (page - 1) * limit;
    const [items, totalItems] = await Promise.all([
      await this.filesModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      await this.filesModel.countDocuments(),
    ]);
    if (!items || items.length < 1) {
      throw new NotFoundException(["no files found"]);
    }
    return {
      items,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
      nextPage: page * limit < totalItems ? page + 1 : null,
    };
  }
  async upload(buket: string, file: Base64URLString): Promise<FilesDocument> {
    try {
      if (!this.commonService.isBase64(file)) {
        throw new BadRequestException(["File not Base64"]);
      }
      if (!buket) {
        throw new BadRequestException(["bucket not Found"]);
      }
      const img: Files = await this.generateImageInfoFromBase64(file, {
        fieldname: "file",
        bucket: buket,
      });
      const fileBuffer = Buffer.from(file, "base64");
      await this.ensureBucketExists(buket);
      const command = new PutObjectCommand({
        Bucket: buket,
        Key: img.key,
        Body: fileBuffer,
        ACL: "public-read",
        ContentType: img.contentType,
      });
      await s3.send(command);
      return await this.filesModel.create(img);
    } catch (error) {
      this.logger.error(error);
      throw new NotAcceptableException(error);
    }
  }
  async getFileByID(_id: string): Promise<FilesDocument> {
    const file: FilesDocument | null = await this.filesModel.findOne({
      _id: _id,
    });
    if (!file) {
      throw new NotFoundException(["File not found"]);
    }
    return file;
  }
  async searchFile(
    bucket?: string,
    fieldname?: string,
    originalname?: string,
    key?: string,
    location?: string,
    contentType?: string,
    mimetype?: string,
  ): Promise<FilesDocument[]> {
    const searchConditions: Partial<Files>[] = [];

    if (bucket) searchConditions.push({ bucket });
    if (fieldname) searchConditions.push({ fieldname });
    if (originalname) searchConditions.push({ originalname });
    if (key) searchConditions.push({ key });
    if (location) searchConditions.push({ location });
    if (contentType) searchConditions.push({ contentType });
    if (mimetype) searchConditions.push({ mimetype });
    if (searchConditions.length === 0) {
      throw new BadRequestException([
        "At least one search field must be provided",
      ]);
    }
    const files: FilesDocument[] = await this.filesModel.find({
      $or: searchConditions,
    });

    if (!files || files.length === 0) {
      throw new NotFoundException(["File not found"]);
    }

    return files;
  }
  async deleteFile(id: string) {
    const findAndDelete = await this.filesModel.findByIdAndDelete(id);
    if (!findAndDelete) {
      throw new NotFoundException(["File not found"]);
    }
    try {
      const command = new DeleteObjectCommand({
        Bucket: findAndDelete.bucket,
        Key: findAndDelete.key,
      });

      await s3.send(command);
      this.logger.debug(
        `✅ Objeto "${findAndDelete.key}" removido com sucesso do bucket "${findAndDelete.bucket}".`,
      );
      return "File deleted";
    } catch (error) {
      this.logger.error(
        `❌ Erro ao remover o objeto "${findAndDelete.key}" do bucket "${findAndDelete.bucket}":`,
        error,
      );
      throw error;
    }
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
  private async generateImageInfoFromBase64(
    base64: Base64URLString,
    options: {
      fieldname: string;
      originalname?: string;
      bucket: string;
      acl?: string;
    },
  ): Promise<Files> {
    const buffer = Buffer.from(base64, "base64");
    const mimeType = (await fileType.fromBuffer(buffer)) as any;
    const allowedTypes = await this.GetTypes();
    if (!allowedTypes.includes(mimeType?.mime)) {
      throw new BadRequestException({
        message: `Invalid content type "${mimeType?.mime}". Allowed types are: ${allowedTypes.join(", ")}`,
      });
    }
    const key = `${Date.now()}-${crypto.randomUUID()}.${mimeType?.ext}`;
    const region = configService.get("REGIONAWS") as string;
    const location: string =
      configService.get("ENV_AMB") == "LOCAL"
        ? `http://localhost:9000/${options.bucket}/${key}`
        : `https://${options.bucket}.s3.${region}.amazonaws.com/${key}`;

    return {
      fieldname: options.fieldname,
      originalname: options.originalname ?? key,
      mimetype: mimeType?.mime,
      size: buffer.length,
      bucket: options.bucket,
      key,
      acl: options?.acl ?? "public-read",
      contentType: mimeType?.mime,
      location: location,
    };
  }
}

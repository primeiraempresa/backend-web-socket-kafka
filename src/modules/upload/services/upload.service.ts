import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Allowed_file_types } from "../models/allowed_file_types.models";
import { Model } from "mongoose";
import { Allowed_file_typesDocument } from "../schemas/allowed_file_types.schema";
import { Files } from "../models/files.models";
import { s3 } from "@config/s3.config";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { FilesDocument } from "../schemas/files.schema";
import { IUploadedFile } from "@common/interface/UploadedFile.interface";

@Injectable()
export class UploadService {
  constructor(
    @InjectModel(Allowed_file_types.name)
    private readonly allowedFileTypesModel: Model<Allowed_file_typesDocument>,
    @InjectModel(Files.name)
    private readonly filesModel: Model<FilesDocument>,
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
  async upload(file: IUploadedFile) {
    file.location = file.location.replace(
      "minio-backend-app-marcelo",
      "localhost",
    );
    return await this.filesModel.create(file);
  }
  async getFile(id: string) {
    const file = await this.filesModel.findById(id);
    if (!file) {
      throw new NotFoundException(["File not found"]);
    }
    return file;
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
    } catch (error) {
      this.logger.error(
        `❌ Erro ao remover o objeto "${findAndDelete.key}" do bucket "${findAndDelete.bucket}":`,
        error,
      );
      throw error;
    }
  }
}

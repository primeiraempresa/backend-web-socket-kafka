import { Module } from "@nestjs/common";
import { UploadService } from "./services/upload.service";
import { UploadController } from "./controllers/upload.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { Allowed_file_types } from "./models/allowed_file_types.models";
import { Allowed_file_typesSchema } from "./schemas/allowed_file_types.schema";
import { Files } from "./models/files.models";
import { FilesSchema } from "./schemas/files.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Allowed_file_types.name,
        schema: Allowed_file_typesSchema,
        collection: Allowed_file_types.name,
      },
      {
        name: Files.name,
        schema: FilesSchema,
        collection: Files.name,
      },
    ]),
  ],
  providers: [UploadService],
  controllers: [UploadController],
  exports: [UploadService],
})
export class UploadModule {}

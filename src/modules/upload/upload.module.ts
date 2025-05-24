import { Module } from "@nestjs/common";
import { UploadService } from "./services/upload.service";
import { UploadController } from "./controllers/upload.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { Allowed_file_types } from "./models/allowed_file_types.model";
import { Allowed_file_typesSchema } from "./schemas/allowed_file_types.schema";
import { Files } from "./models/files.model";
import { FilesSchema } from "./schemas/files.schema";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { configService } from "@config/configService";
import { UploadProducerService } from "./services/upload.producer.service";
import { UploadConsumerController } from "./controllers/upload.consumer.controller";

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
    ClientsModule.register([
      {
        name: "UPLOAD_MODULE",
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: [configService.get<string>("KAFKA_BROKER") as string],
            retry: {
              retries: 10,
              initialRetryTime: 3000, // 3s entre tentativas
            },
          },
          consumer: {
            groupId: configService.get<string>("KAFKA_GROUP_ID") as string,
            allowAutoTopicCreation: true,
          },
        },
      },
    ]),
  ],
  providers: [UploadService, UploadProducerService],
  controllers: [UploadController, UploadConsumerController],
  exports: [UploadService, UploadProducerService],
})
export class UploadModule {}

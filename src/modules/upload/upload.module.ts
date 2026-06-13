import { Module } from "@nestjs/common";
import { UploadService } from "./services/upload.service";
import { UploadController } from "./controllers/upload.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { AllowedFileTypes } from "./models/allowed_file_types.model";
import { Allowed_file_typesSchema } from "./schemas/allowed_file_types.schema";
import { Files } from "./models/files.model";
import { FilesSchema } from "./schemas/files.schema";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { configService } from "@config/config.service";
import { UserModule } from "@user/user.module";
import { UploadGateway } from "./gateway/upload.gateway";
import { CommonModule } from "@common/common.module";
import { UploadConsumerController } from "./controllers/upload.consumer.controller";
import { UploadProducerService } from "./services/upload.producer.service";
import { grupIDs } from "@common/utils/groupsID.util";

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        {
          name: AllowedFileTypes.name,
          schema: Allowed_file_typesSchema,
          collection: AllowedFileTypes.name,
        },
        {
          name: Files.name,
          schema: FilesSchema,
          collection: Files.name,
        },
      ],
      "Datas",
    ),
    ClientsModule.register([
      {
        name: "UPLOAD_MODULE",
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: [configService.get<string>("KAFKA_BROKER") as string],
            retry: {
              retries: 10,
              initialRetryTime: 3000,
            },
          },
          consumer: {
            groupId: grupIDs,
            allowAutoTopicCreation: true,
          },
        },
      },
    ]),
    UserModule,
    CommonModule,
  ],
  providers: [UploadService, UploadGateway, UploadProducerService],
  controllers: [UploadController, UploadConsumerController],
  exports: [UploadService, UploadProducerService],
})
export class UploadModule {}

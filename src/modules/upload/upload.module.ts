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
import { UserModule } from "@user/user.module";
import { UploadGateway } from "./gateway/upload.gateway";
import { CommonModule } from "@common/common.module";
import { UploadConsumerController } from "./controllers/upload.consumer.controller";
import { UploadProducerService } from "./services/upload.producer.service";

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
              initialRetryTime: 3000,
            },
          },
          consumer: {
            groupId: configService.get<string>("KAFKA_GROUP_ID") as string,
            allowAutoTopicCreation: true,
          },
        },
      },
    ]),
    UserModule,
    CommonModule,
  ],
  providers: [
    UploadService,
    UploadGateway,
    {
      provide: "UploadProducerService_create",
      useClass: UploadProducerService,
    },
  ],
  controllers: [UploadController, UploadConsumerController],
  exports: [UploadService],
})
export class UploadModule {}

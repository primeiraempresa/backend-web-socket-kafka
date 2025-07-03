import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configService } from "@config/configService";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger, ValidationPipe } from "@nestjs/common";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { ExpressAdapter } from "@bull-board/express";
import { WsAdapter } from "@nestjs/platform-ws";
import { createBullBoard } from "@bull-board/api";
import * as Queue from "bull";
import { BullAdapter } from "@bull-board/api/bullAdapter";
import { redisSentinelsConfig } from "@config/redisSentinels.config";

async function bootstrap() {
  const logger = new Logger();
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableCors();
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.setGlobalPrefix("/api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  //Config Swagger
  const configSwagger = new DocumentBuilder()
    .setTitle("API app Marcelo")
    .setDescription("API description")
    .setVersion(configService.get<string>("APP_VERSION") || "")
    .addOAuth2({
      type: "oauth2",
      flows: {
        password: {
          tokenUrl: `${configService.get<string>("URL")}api/auth/`,
          scopes: {
            read: "read",
            write: "write",
          },
        },
      },
    })
    .build();
  const document = SwaggerModule.createDocument(app, configSwagger);
  SwaggerModule.setup("swagger", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      initOAuth: {
        appName: "API app Marcelo. ",
      },
    },
    jsonDocumentUrl: "swagger.json",
  });
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [configService.get<string>("KAFKA_BROKER") as string],
      },
      consumer: {
        groupId: configService.get<string>("KAFKA_GROUP_ID") as string,
        allowAutoTopicCreation: true,
      },
    },
  });
  await app.startAllMicroservices();
  //Config Bull DashBord
  const serverAdapter = new ExpressAdapter();
  const queue_chat = new Queue("chat", { redis: redisSentinelsConfig });
  const queue_chat_process = new Queue("chat.process", {
    redis: redisSentinelsConfig,
  });
  serverAdapter.setBasePath("/admin/queues/");
  createBullBoard({
    queues: [new BullAdapter(queue_chat), new BullAdapter(queue_chat_process)],
    serverAdapter,
  });
  app.use("/admin/queues", serverAdapter.getRouter());

  await app.listen(configService.get<number>("PORT") ?? 3000);
  logger.debug(`sever on in ${await app.getUrl()}`);
  logger.debug(`swagger on in ${await app.getUrl()}/swagger`);
  logger.debug(`S3 Local on in http://localhost:9000`);
  logger.debug(`UI of Kafka on in http://localhost:8080`);
  logger.debug(`Bull Board on in ${await app.getUrl()}/admin/queues/`);
}
bootstrap().catch((err: Error) => {
  const logger = new Logger();
  logger.error("Error starting the application", err);
  process.exit(1);
});

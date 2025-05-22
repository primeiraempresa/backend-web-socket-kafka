import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configService } from "@config/configService";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger, ValidationPipe } from "@nestjs/common";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";

async function bootstrap() {
  const logger = new Logger();
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.setGlobalPrefix("/api");
  const configSwagger = new DocumentBuilder()
    .setTitle("API app Marcelo")
    .setDescription("API description")
    .setVersion(configService.get<string>("APP_VERSION") || "")
    .addOAuth2({
      type: "oauth2",
      flows: {
        password: {
          tokenUrl: configService.get<string>("AUTH_URL"),
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
  });
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [configService.get<string>("KAFKA_BROKER") as string],
        clientId: configService.get<string>("KAFKA_CLIENT_ID") as string,
      },
      consumer: {
        groupId: configService.get<string>("KAFKA_GROUP_ID") as string,
        allowAutoTopicCreation: true,
      },
    },
  });
  await app.startAllMicroservices();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.listen(configService.get<number>("PORT") ?? 3000);
  logger.debug(`sever on in ${await app.getUrl()}`);
  logger.debug(`swagger on in ${await app.getUrl()}/swagger`);
  logger.debug(`S3 Local on in http://localhost:9000`);
  logger.debug(`UI of Kafka on in http://localhost:8080`);
}
bootstrap().catch((err: Error) => {
  const logger = new Logger();
  logger.error("Error starting the application", err);
  process.exit(1);
});

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configService } from '@config/configService';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.setGlobalPrefix('/api');
  const configSwagger = new DocumentBuilder()
    .setTitle('API app MArcelo')
    .setDescription('API description')
    .setVersion(configService.get<string>('VERSION') || '')
    .addTag('API')
    .build();
  const document = SwaggerModule.createDocument(app, configSwagger);
  SwaggerModule.setup('swagger', app, document);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.listen(configService.get<number>('PORT') ?? 3000);
}
bootstrap();

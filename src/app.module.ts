import { Module } from '@nestjs/common';
import { UserModule } from './modules/user/user.module';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import winstonConfig from '@config/winston.config';
import { MongooseModule } from '@nestjs/mongoose';
import { configService } from '@config/configService';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(
      configService.get<string>('DBAAS_MONGODB_ENDPOINT') || '',
    ),
    WinstonModule.forRoot(winstonConfig),
    UserModule,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ImageService } from './services/image.service';
import { ImageController } from './controllers/image.controller';

@Module({

  providers: [ImageService],

  controllers: [ImageController]
})
export class ImageModule {}

import { Prop } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class Sports {
  @ApiProperty({ default: false })
  @IsBoolean({ message: 'campo academia deve ser Boolean' })
  @Prop({ required: true, default: false })
  academia: boolean;

  @ApiProperty({ default: false })
  @IsBoolean({ message: 'campo caminhada deve ser Boolean' })
  @Prop({ required: true, default: false })
  caminhada: boolean;

  @ApiProperty({ default: false })
  @IsBoolean({ message: 'campo crossfit deve ser Boolean' })
  @Prop({ required: true, default: false })
  crossfit: boolean;

  @ApiProperty({ default: false })
  @IsBoolean({ message: 'campo futebol deve ser Boolean' })
  @Prop({ required: true, default: false })
  futebol: boolean;

  @ApiProperty({ default: false })
  @IsBoolean({ message: 'campo futevolei deve ser Boolean' })
  @Prop({ required: true, default: false })
  futevolei: boolean;
}

import { Sports } from './sports.model';
import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { ObjectId } from 'mongoose';
@Schema()
export class Users {
  @ApiProperty({ required: true })
  @Prop({ required: true })
  @IsNotEmpty({ message: 'Nome de usário vazio' })
  @IsString({ message: 'campo username deve ser uma string' })
  username: string;

  @ApiProperty({ required: true })
  @Prop({ required: true })
  esportes: Sports;

  @ApiProperty()
  //   @Prop({ type: mongoose.Schema.Types.ObjectId, ref: imagem.name, default: null, required: true })
  profilePic: ObjectId | null | string;
}

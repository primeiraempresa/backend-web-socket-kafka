import { Sports } from "./sports.model";
import { Prop, Schema } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsString,
  IsStrongPassword,
} from "class-validator";
import mongoose from "mongoose";
@Schema()
export class Users {
  @ApiProperty({ required: true })
  @Prop({ required: true, index: true, unique: true })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({ required: true })
  @Prop({ required: true, index: true, unique: true })
  @IsNotEmpty()
  @IsEmail({ allow_display_name: true }, { message: "Invalid email. " })
  @IsString()
  email: string;

  @ApiProperty({ required: true })
  @Prop({ required: true })
  @IsStrongPassword({ minLength: 8, minUppercase: 1, minSymbols: 1 })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({ required: true })
  @Prop({ required: true })
  @IsObject()
  esportes: Sports;

  @ApiProperty({ default: null })
  @Prop({ required: false, default: null })
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: File.name,
    default: null,
    required: true,
    index: true,
  })
  profilePic: string;
}

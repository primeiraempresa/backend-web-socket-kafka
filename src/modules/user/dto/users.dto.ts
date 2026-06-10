import { Prop } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { Files } from "@upload/models/files.model";
import { Sports } from "@user/models/sports.model";
import { UserSport } from "@user/models/user-sport.model";
import { UserSport_schema } from "@user/schemas/user-sport.schem";
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsStrongPassword,
} from "class-validator";
import mongoose from "mongoose";
export class UsersDto {
  _id?: string;
  @ApiProperty({ required: true })
  @Prop({ required: true })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ required: true })
  @Prop({ required: true })
  @IsEmail({ allow_display_name: true }, { message: "Invalid email" })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: true })
  @Prop({ required: true })
  @IsStrongPassword({ minLength: 8, minUppercase: 1, minSymbols: 1 })
  @IsNotEmpty()
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({ required: true })
  @IsObject()
  @IsOptional()
  esportes?: Partial<Sports>;

  @ApiProperty({ default: null })
  @Prop({ required: false, default: null })
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Files.name,
    default: null,
    required: true,
  })
  @IsOptional()
  profilePic?: string;

  @ApiProperty({ type: [UserSport], required: false })
  @IsArray()
  @IsOptional()
  @Prop({ type: [UserSport_schema], default: [] })
  sports?: UserSport[];
}

import { Prop, Schema } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
} from "class-validator";
import mongoose from "mongoose";
import { UserSport } from "./user-sport.model";
import { UserSport_schema } from "@user/schemas/user-sport.schem";

@Schema()
export class Users {
  @ApiProperty({ required: true })
  @Prop({ required: true, index: true, unique: true })
  @IsNotEmpty()
  @IsString()
  username!: string;

  @ApiProperty({ required: true })
  @Prop({ required: true, index: true, unique: true })
  @IsNotEmpty()
  @IsEmail({ allow_display_name: true }, { message: "Invalid email. " })
  @IsString()
  email!: string;

  @ApiProperty({ required: true })
  @Prop({ required: true })
  @IsStrongPassword({ minLength: 8, minUppercase: 1, minSymbols: 1 })
  @IsNotEmpty()
  @IsString()
  password!: string;

  @ApiProperty({ type: [UserSport], required: false })
  @IsArray()
  @Type(() => UserSport)
  @Prop({ type: [UserSport_schema], default: [] })
  sports!: UserSport[];

  @ApiProperty({ default: null })
  @Prop({ required: false, default: null })
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: File.name,
    default: null,
    required: true,
    index: true,
  })
  profilePic!: string;
}

import { Prop, Schema } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { Users } from "@user/models/user.model";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import mongoose from "mongoose";
import { IsObjectId } from "src/modules/common/validations/IsObjctId.validation";

@Schema()
export class Chat_conversation_DTO {
  @ApiProperty({ required: false, default: "Olá !" })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  message?: string;
}

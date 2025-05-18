import { Schema } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

@Schema()
export class Chat_conversation_DTO {
  @ApiProperty({ required: false, default: "Olá !" })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  message?: string;
}

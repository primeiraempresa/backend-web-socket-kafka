import { Schema } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

@Schema()
export class Chat_conversation_DTO {
  @ApiProperty({ required: true, default: "Olá !" })
  @IsNotEmpty()
  @IsString()
  message: string;
}

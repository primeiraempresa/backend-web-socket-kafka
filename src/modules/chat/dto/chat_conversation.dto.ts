import { Prop, Schema } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { Files } from "@upload/models/files.model";
import { FilesDocument, FilesSchema } from "@upload/schemas/files.schema";
import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";
import mongoose from "mongoose";

@Schema()
export class ChatConversationDTO {
  @ApiProperty({ required: false })
  @IsNotEmpty()
  @IsOptional()
  @IsString()
  message?: string;
  @ApiProperty({ type: [Files], description: "Array de URLs de imagens" })
  @Prop({
    type: [mongoose.Schema.Types.ObjectId],
    ref: Files.name,
    required: false,
    index: true,
    schema: FilesSchema,
    default: null,
  })
  @IsArray()
  @IsOptional()
  images?: FilesDocument[] | null;
}

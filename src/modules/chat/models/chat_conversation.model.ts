import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { Files } from "@upload/models/files.model";
import { FilesDocument, FilesSchema } from "@upload/schemas/files.schema";
import { Users } from "@user/models/user.model";
import { IsMongoId, IsOptional, IsString, IsArray } from "class-validator";
import mongoose from "mongoose";

@Schema({ timestamps: { createdAt: "createdAt" } })
export class ChatConversation {
  @ApiProperty({ required: false, default: "Olá !" })
  @Prop()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ required: true, default: "_id of user" })
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Users.name,
    required: true,
    index: true,
  })
  @IsMongoId()
  sender!: string;

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
  images?: FilesDocument[];

  @ApiProperty({
    required: false,
    description: "URL de um arquivo (PDF, DOC, etc)",
  })
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Files.name,
    required: false,
    index: true,
    schema: FilesSchema,
    default: null,
  })
  @IsOptional()
  file?: FilesDocument;

  @Prop()
  createdAt?: Date;
}

export const ChatConversationSchema =
  SchemaFactory.createForClass(ChatConversation);

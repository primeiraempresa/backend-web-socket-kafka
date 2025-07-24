import { Prop, Schema } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { Files } from "@upload/models/files.model";
import { FilesDocument, FilesSchema } from "@upload/schemas/files.schema";
import { Users } from "@user/models/user.model";
import {
  IsMongoId,
  IsOptional,
  IsString,
  IsArray,
  IsBoolean,
  IsDate,
} from "class-validator";
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
  sender: string;

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

  @ApiProperty({
    description: "Lista de usuários que visualizaram a mensagem",
    example: ["67d21a67b5aed094d5c435e5", "67d21a67b5aed094d5c435e3"],
  })
  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: Users.name }],
    required: false,
    default: [],
    index: true,
  })
  @IsArray()
  @IsOptional()
  @IsMongoId({ each: true })
  readBy?: string[];

  @ApiProperty({
    description: "Timestamp de quando cada usuário leu a mensagem",
    example: {
      "67d21a67b5aed094d5c435e5": "2024-01-15T10:30:00Z",
      "67d21a67b5aed094d5c435e3": "2024-01-15T11:00:00Z",
    },
  })
  @Prop({
    type: Map,
    of: Date,
    default: {},
    required: false,
  })
  @IsOptional()
  readAt?: Map<string, Date>;

  @ApiProperty({
    description: "Lista de usuários que receberam a mensagem",
    example: ["67d21a67b5aed094d5c435e5", "67d21a67b5aed094d5c435e3"],
  })
  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: Users.name }],
    required: false,
    default: [],
    index: true,
  })
  @IsArray()
  @IsOptional()
  @IsMongoId({ each: true })
  deliveredTo?: string[];

  @ApiProperty({
    description: "Timestamp de quando cada usuário recebeu a mensagem",
    example: {
      "67d21a67b5aed094d5c435e5": "2024-01-15T10:25:00Z",
      "67d21a67b5aed094d5c435e3": "2024-01-15T10:26:00Z",
    },
  })
  @Prop({
    type: Map,
    of: Date,
    default: {},
    required: false,
  })
  @IsOptional()
  deliveredAt?: Map<string, Date>;

  @ApiProperty({
    description: "Indica se a mensagem foi editada",
    example: false,
  })
  @Prop({
    type: Boolean,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isEdited?: boolean;

  @ApiProperty({
    description: "Timestamp da última edição",
    example: "2024-01-15T10:35:00Z",
  })
  @Prop({
    required: false,
  })
  @IsOptional()
  @IsDate()
  editedAt?: Date;

  @ApiProperty({
    description: "Tipo da mensagem (text, image, file, system)",
    example: "text",
  })
  @Prop({
    type: String,
    enum: ["text", "image", "file", "system", "audio", "video"],
    default: "text",
    required: false,
  })
  @IsOptional()
  messageType?: string;

  @ApiProperty({
    description: "ID da mensagem que está sendo respondida",
    example: "67d21a67b5aed094d5c435e8",
  })
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    index: true,
  })
  @IsOptional()
  @IsMongoId()
  replyTo?: string;

  @ApiProperty({
    description: "Indica se a mensagem foi deletada",
    example: false,
  })
  @Prop({
    type: Boolean,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;

  @ApiProperty({
    description: "Timestamp da deleção",
    example: "2024-01-15T10:40:00Z",
  })
  @Prop({
    required: false,
  })
  @IsOptional()
  @IsDate()
  deletedAt?: Date;

  @ApiProperty({
    description: "Reações à mensagem",
    example: {
      "👍": ["67d21a67b5aed094d5c435e5"],
      "❤️": ["67d21a67b5aed094d5c435e3"],
    },
  })
  @Prop({
    type: Map,
    of: [String],
    default: {},
    required: false,
  })
  @IsOptional()
  reactions?: Map<string, string[]>;

  @ApiProperty({
    description: "Metadados adicionais da mensagem",
    example: { location: { lat: -23.5505, lng: -46.6333 } },
  })
  @Prop({
    type: mongoose.Schema.Types.Mixed,
    required: false,
  })
  @IsOptional()
  metadata?: any;
}

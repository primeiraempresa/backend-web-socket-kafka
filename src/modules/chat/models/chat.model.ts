import { Prop, Schema } from "@nestjs/mongoose";
import mongoose from "mongoose";
import { Users } from "@user/models/user.model";
import {
  ArrayNotEmpty,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { ChatConversation } from "./chat_conversation.model";

@Schema({ timestamps: { createdAt: "createdAt" } })
export class Chats {
  @ApiProperty({
    required: true,
    default: ["67d21a67b5aed094d5c435e5", "67d21a67b5aed094d5c435e3"],
    description: "Array of users ids",
    minItems: 2,
    type: [String],
    example: ["67d21a67b5aed094d5c435e5", "67d21a67b5aed094d5c435e3"],
  })
  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: Users.name }],
    required: true,
    index: true,
  })
  @IsArray()
  @IsNotEmpty()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  chatters: string[];

  @Prop({
    required: false,
  })
  createdAt: Date;

  @Prop({
    required: false,
  })
  updatedAt: Date;

  @Prop({
    required: false,
  })
  lastMessage?: ChatConversation;

  @Prop({
    required: false,
  })
  chatName?: string;
  @ApiProperty({
    description: "Contador de mensagens não lidas por usuário",
    example: { "67d21a67b5aed094d5c435e5": 3, "67d21a67b5aed094d5c435e3": 0 },
  })
  @Prop({
    type: Map,
    of: Number,
    default: {},
    required: false,
  })
  @IsOptional()
  unreadCount?: Map<string, number>;

  @ApiProperty({
    description: "Última vez que cada usuário visualizou o chat",
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
  lastSeenAt?: Map<string, Date>;

  @ApiProperty({
    description: "Status de notificações ativadas para cada usuário",
    example: {
      "67d21a67b5aed094d5c435e5": true,
      "67d21a67b5aed094d5c435e3": false,
    },
  })
  @Prop({
    type: Map,
    of: Boolean,
    default: {},
    required: false,
  })
  @IsOptional()
  notificationsEnabled?: Map<string, boolean>;

  @ApiProperty({
    description: "Indica se o chat está arquivado para cada usuário",
    example: {
      "67d21a67b5aed094d5c435e5": false,
      "67d21a67b5aed094d5c435e3": true,
    },
  })
  @Prop({
    type: Map,
    of: Boolean,
    default: {},
    required: false,
  })
  @IsOptional()
  isArchived?: Map<string, boolean>;

  @ApiProperty({
    description: "Indica se o chat está mutado para cada usuário",
    example: {
      "67d21a67b5aed094d5c435e5": false,
      "67d21a67b5aed094d5c435e3": true,
    },
  })
  @Prop({
    type: Map,
    of: Boolean,
    default: {},
    required: false,
  })
  @IsOptional()
  isMuted?: Map<string, boolean>;

  @ApiProperty({
    description: "Tipo do chat (individual, grupo, canal)",
    example: "individual",
  })
  @Prop({
    type: String,
    enum: ["individual", "group", "channel"],
    default: "individual",
    required: false,
  })
  @IsOptional()
  chatType?: string;

  @ApiProperty({
    description: "Administradores do chat (para grupos)",
    example: ["67d21a67b5aed094d5c435e5"],
  })
  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: Users.name }],
    required: false,
    default: [],
  })
  @IsArray()
  @IsOptional()
  @IsMongoId({ each: true })
  admins?: string[];

  @ApiProperty({
    description: "Descrição do chat/grupo",
    example: "Grupo de trabalho da equipe de desenvolvimento",
  })
  @Prop({
    required: false,
  })
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: "Avatar/imagem do chat",
    example: "https://example.com/chat-avatar.jpg",
  })
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: File.name,
    default: null,
    required: false,
    index: true,
  })
  @IsOptional()
  avatar?: string;
}

import { Prop, Schema } from "@nestjs/mongoose";
import mongoose from "mongoose";
import { Users } from "@user/models/user.model";
import { ArrayNotEmpty, IsArray, IsMongoId, IsNotEmpty } from "class-validator";
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
  chatters!: string[];

  @Prop({
    required: false,
  })
  createdAt!: Date;

  @Prop({
    required: false,
  })
  updatedAt!: Date;

  @Prop({
    required: false,
  })
  lastMessage?: ChatConversation;

  @Prop({
    required: false,
  })
  chatName?: string;
}

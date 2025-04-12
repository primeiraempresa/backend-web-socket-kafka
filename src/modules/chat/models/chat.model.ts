import { Prop, Schema } from "@nestjs/mongoose";
import mongoose from "mongoose";
import { Users } from "@user/models/user.model";
import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

@Schema()
export class Chats {
  @ApiProperty({
    required: true,
    default: ["67d21a67b5aed094d5c435e5", "67d21a67b5aed094d5c435e3"],
    description: "Array of users ids",
  })
  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: Users.name }],
    required: true,
  })
  @IsNotEmpty()
  chatters: [string];
}

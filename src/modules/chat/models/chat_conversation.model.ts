import { Prop, Schema } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { Users } from "@user/models/user.model";
import { IsNotEmpty, IsString } from "class-validator";
import mongoose, { HydratedDocument } from "mongoose";

@Schema()
export class Chat_conversation {
  @ApiProperty({ required: true, default: "Olá !" })
  @Prop({ required: true })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiProperty({ required: true, default: "_id of user" })
  @IsNotEmpty()
  @IsString()
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Users.name,
    required: true,
  })
  sender: string;

  @Prop({ required: true, default: new Date().toISOString() })
  createdAt: Date;
}

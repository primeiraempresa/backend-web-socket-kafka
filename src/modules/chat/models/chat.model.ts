import { Prop, Schema } from "@nestjs/mongoose";
import mongoose from "mongoose";
import { Users } from "@user/models/user.model";
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { IsArryByObjectIds } from "src/modules/common/validations/IsArrayByObjectIds.validation";

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
    index: true,
  })
  @IsArray()
  @IsNotEmpty()
  @ArrayNotEmpty()
  @IsArryByObjectIds()
  chatters: mongoose.Types.ObjectId[];
}

import { Prop, Schema } from "@nestjs/mongoose";
import mongoose, { Types } from "mongoose";
import { Sports } from "./sports.model";
import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

@Schema({ _id: false, versionKey: false })
export class UserSport {
  @ApiProperty({ default: "_id do esporte", required: true })
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Sports.name,
    required: true,
  })
  sport!: Types.ObjectId;

  @ApiProperty({ default: true })
  @IsBoolean()
  @Prop({ default: true })
  active!: boolean;
}

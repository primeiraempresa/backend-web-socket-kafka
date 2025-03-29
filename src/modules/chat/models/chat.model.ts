import { Prop, Schema } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

@Schema()
export class Chat {
  @ApiProperty({ required: true, default: "Olá !" })
  @Prop({ required: true })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiProperty({ required: true, default: "_id of user" })
  @Prop({ required: true })
  @IsNotEmpty()
  @IsString()
  sender: string;
  
  @Prop({ required: true, default: new Date().toISOString() })
  timestamp: string;
}

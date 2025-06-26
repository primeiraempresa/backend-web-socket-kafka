import { Prop, Schema } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

@Schema()
export class AllowedFileTypes {
  @ApiProperty({
    required: true,
    default: "image/jpeg",
    description: "type of file",
  })
  @Prop({
    required: true,
    index: true,
    unique: true,
  })
  @IsNotEmpty()
  @IsString()
  type: string;
}

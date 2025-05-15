import { Prop, Schema } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

@Schema()
export class Allowed_file_types {
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

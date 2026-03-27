import { Prop, Schema } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
@Schema({ versionKey: false })
export class Sports {
  @ApiProperty({ default: "academia" })
  @IsString({ message: "campo do nome do esporte de ser string" })
  @IsNotEmpty()
  @Prop({ required: true, index: true, unique: true })
  name!: string;
}

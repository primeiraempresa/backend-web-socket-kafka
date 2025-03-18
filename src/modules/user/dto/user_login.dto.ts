import { Prop } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class UserLogin {
  @ApiProperty({ required: true })
  @Prop({ required: true })
  @IsNotEmpty()
  @IsString()
  user: string;

  @ApiProperty({ required: true })
  @Prop({ required: true })
  @IsNotEmpty()
  @IsString()
  password: string;
}

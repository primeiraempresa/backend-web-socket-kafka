import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class SportDTO {
  @ApiProperty({ default: "academia" })
  @IsString({ message: "campo do nome do esporte de ser string" })
  @IsNotEmpty()
  @IsOptional()
  name?: string;
}

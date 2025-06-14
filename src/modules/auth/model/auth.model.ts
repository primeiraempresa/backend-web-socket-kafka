import { IsNotEmpty, IsString } from "class-validator";

export class AuthModel {
  @IsString()
  @IsNotEmpty()
  client_id: string;
  @IsString()
  @IsNotEmpty()
  client_secret: string;
}

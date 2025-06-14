import { AuthModel } from "@auth/model/auth.model";
import { AuthService } from "@auth/services/auth.service";
import { IToken } from "@common/interface/acessToken.interface";
import { Body, Controller, Post } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post()
  @ApiExcludeEndpoint()
  auth(@Body() body: AuthModel): IToken {
    return this.authService.validate(body.client_id, body.client_secret);
  }
}

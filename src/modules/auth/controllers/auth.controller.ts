import { AuthService } from "@auth/services/auth.service";
import { Body, Controller, Post } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post()
  @ApiExcludeEndpoint()
  async auth(@Body() body: { client_id: string; client_secret: string }) {
    return  await this.authService.validate(
      body.client_id,
      body.client_secret,
    );
  }
}

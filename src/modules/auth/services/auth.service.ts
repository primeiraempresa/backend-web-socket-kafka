import { configService } from "@config/configService";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}
  private access_token: {
    access_token: string;
  };
  private async setAccessToken(token: { access_token: string }) {
    this.access_token = token;
  }
  async getAccessToken() {
    return this.access_token;
  }
  async validate(client_id: string, client_secret: string) {
    if (
      client_id != configService.get<string>("client_id") ||
      client_secret != configService.get<string>("client_secret")
    ) {
      throw new UnauthorizedException();
    }
    const id = `${new Date().getUTCDate()}-${configService.get<string>("client_id")}`;
    const hash = id
      .split("")
      .reduce(
        (hex: string, c) => hex + c.charCodeAt(0).toString(16).padStart(2, "0"),
        "",
      );
    return await this.generateToken({
      id: hash,
    });
  }
  async validateUserById(userId: string): Promise<boolean> {
    const id = `${new Date().getUTCDate()}-${configService.get<string>("client_id")}`;
    const hash = id
      .split("")
      .reduce(
        (hex: string, c) => hex + c.charCodeAt(0).toString(16).padStart(2, "0"),
        "",
      );
      console.log(hash)
    return hash == userId;
  }

  async generateToken(user: { id: string }): Promise<{ access_token: string }> {
    const payload = { sub: user.id };
    await this.setAccessToken({
      access_token: this.jwtService.sign(payload),
    });
    return await this.getAccessToken();
  }
}

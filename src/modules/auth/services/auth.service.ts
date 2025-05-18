import { IToken } from "@common/interface/acessToken.interface";
import { configService } from "@config/configService";
import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}
  private access_token: IToken;
  private setAccessToken(token: IToken): IToken {
    return (this.access_token = token);
  }
  getAccessToken(): {
    access_token: string;
    token_type: string;
  } {
    return this.access_token;
  }
  validate(client_id: string, client_secret: string): IToken {
    if (
      client_id != configService.get<string>("client_id") ||
      client_secret != configService.get<string>("client_secret")
    ) {
      throw new UnauthorizedException();
    }
    const id = configService.get<string>("client_id")?.toString();
    if (id) {
      const hash = id
        .split("")
        .reduce(
          (hex: string, c) =>
            hex + c.charCodeAt(0).toString(16).padStart(2, "0"),
          "",
        );
      return this.generateToken({
        id: hash,
      });
    }
    throw new ServiceUnavailableException(["client_id not found in server"]);
  }
  validateUserById(userId: string): boolean {
    const id = configService.get<string>("client_id")?.toString();
    if (id) {
      const hash = id
        .split("")
        .reduce(
          (hex: string, c) =>
            hex + c.charCodeAt(0).toString(16).padStart(2, "0"),
          "",
        );
      return hash == userId;
    }
    return false;
  }

  generateToken(user: { id: string }): IToken {
    const payload = { sub: user.id };
    this.setAccessToken({
      access_token: this.jwtService.sign(payload),
      token_type: "bearer",
    });
    return this.getAccessToken();
  }
}

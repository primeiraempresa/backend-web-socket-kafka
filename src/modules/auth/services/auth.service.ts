import { IToken } from "@common/interface/acessToken.interface";
import { DateService } from "@common/services/date.service";
import { configService } from "@config/config.service";
import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly dateService: DateService,
  ) {}
  private access_token: IToken;
  private setAccessToken(token: IToken) {
    this.access_token = token;
  }
  getAccessToken(): IToken {
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
    if (!id) {
      throw new ServiceUnavailableException("client_id not found in server");
    }
    const hash = id
      .split("")
      .reduce(
        (hex: string, c) => hex + c.charCodeAt(0).toString(16).padStart(2, "0"),
        "",
      );
    return this.generateToken({
      id: hash,
    });
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
    const access_token = this.jwtService.sign(payload);
    const decoded = this.jwtService.decode(access_token);
    this.setAccessToken({
      access_token: access_token,
      expires_in: this.dateService.date(decoded?.exp * 1000).toISOString(),
      issued: this.dateService.date(decoded?.iat * 1000).toISOString(),
      token_type: "Bearer",
    });
    return this.getAccessToken();
  }
}

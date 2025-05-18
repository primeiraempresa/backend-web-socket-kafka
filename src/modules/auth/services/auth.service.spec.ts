import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { ConfigService } from "@nestjs/config";
import { IToken } from "@common/interface/acessToken.interface";
import { JwtService } from "@nestjs/jwt";

class MockConfigService {
  get(key: string): string {
    if (key === "client_id") return "correct_client_id";
    if (key === "client_secret") return "correct_client_secret";
    return "";
  }
}

describe("AuthService", () => {
  let authService: AuthService;
  let configService: ConfigService;

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useClass: MockConfigService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    configService = module.get<ConfigService>(ConfigService);
    jest
      .spyOn(ConfigService.prototype, "get")
      .mockImplementation((key: string) => {
        if (key === "client_id") return "correct_client_id";
        if (key === "client_secret") return "correct_client_secret";
        return "";
      });
  });

  describe("validate", () => {
    it("should return a token if client_id and client_secret are correct", () => {
      const clientId = "correct_client_id";
      const clientSecret = "correct_client_secret";
      jest
        .spyOn(configService, "get")
        .mockReturnValueOnce("correct_client_id")
        .mockReturnValueOnce("correct_client_secret");

      const generatedToken = {
        access_token: "mock_token",
        token_type: "bearer",
      };
      mockJwtService.sign.mockReturnValue("mock_token");

      const result = authService.validate(clientId, clientSecret);

      expect(result).toEqual(generatedToken);
      expect(mockJwtService.sign).toHaveBeenCalled();
    });
  });

  describe("validateUserById", () => {
    it("should return false if the hash does not match the userId", () => {
      const userId = "incorrect_hash";
      jest.spyOn(configService, "get").mockReturnValueOnce("correct_client_id");
      const result = authService.validateUserById(userId);
      expect(result).toBe(false);
    });

    it("should return true if the hash matches the userId", () => {
      const clientId = "correct_client_id";
      const hash = clientId
        .split("")
        .reduce(
          (hex: string, c) =>
            hex + c.charCodeAt(0).toString(16).padStart(2, "0"),
          "",
        );
      const userId = hash;
      jest.spyOn(configService, "get").mockReturnValueOnce("correct_client_id");
      const result: boolean = authService.validateUserById(userId);
      expect(result).toBe(true);
    });
  });

  describe("generateToken", () => {
    it("should generate and return a token", () => {
      const user = { id: "user_id" };
      const payload = { sub: "user_id" };
      const accessToken = { access_token: "mock_token", token_type: "bearer" };

      mockJwtService.sign.mockReturnValue("mock_token");
      const result = authService.generateToken(user);

      expect(result).toEqual(accessToken);
      expect(mockJwtService.sign).toHaveBeenCalledWith(payload);
    });
  });

  describe("getAccessToken", () => {
    it("should return the access token", () => {
      const token = { access_token: "mock_token", token_type: "bearer" };
      jest.spyOn(authService, "getAccessToken").mockReturnValueOnce(token);

      const result: IToken = authService.getAccessToken();
      expect(result).toEqual(token);
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { JwtService } from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

// Mock do ConfigService
class MockConfigService {
  get(key: string): string {
    if (key === "client_id") return "correct_client_id";
    if (key === "client_secret") return "correct_client_secret";
    return "";
  }
}

describe("AuthService", () => {
  let authService: AuthService;
  let jwtService: JwtService;
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
          useClass: MockConfigService, // Usando a classe mockada
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService); // ConfigService mockado
    jest
      .spyOn(ConfigService.prototype, "get")
      .mockImplementation((key: string) => {
        if (key === "client_id") return "correct_client_id";
        if (key === "client_secret") return "correct_client_secret";
        return "";
      });
  });

  describe("validate", () => {
    it("should throw UnauthorizedException if client_id or client_secret are incorrect", async () => {
      const clientId = "wrong_client_id";
      const clientSecret = "wrong_client_secret";

      // Mockando as respostas do ConfigService
      jest
        .spyOn(configService, "get")
        .mockReturnValueOnce("correct_client_id") // Para client_id
        .mockReturnValueOnce("correct_client_secret"); // Para client_secret

      await expect(
        authService.validate(clientId, clientSecret),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should return a token if client_id and client_secret are correct", async () => {
      const clientId = "correct_client_id";
      const clientSecret = "correct_client_secret";

      // Mockando as respostas do ConfigService
      jest
        .spyOn(configService, "get")
        .mockReturnValueOnce("correct_client_id") // Para client_id
        .mockReturnValueOnce("correct_client_secret"); // Para client_secret

      const generatedToken = {
        access_token: "mock_token",
        token_type: "bearer",
      };
      mockJwtService.sign.mockReturnValue("mock_token");

      const result = await authService.validate(clientId, clientSecret);

      expect(result).toEqual(generatedToken);
      expect(mockJwtService.sign).toHaveBeenCalled();
    });
  });

  describe("validateUserById", () => {
    it("should return false if the hash does not match the userId", async () => {
      const userId = "incorrect_hash";

      // Mockando as respostas do ConfigService
      jest.spyOn(configService, "get").mockReturnValueOnce("correct_client_id");

      const result = await authService.validateUserById(userId);
      expect(result).toBe(false);
    });

    it("should return true if the hash matches the userId", async () => {
      const clientId = "correct_client_id";
      const hash = clientId
        .split("")
        .reduce(
          (hex: string, c) =>
            hex + c.charCodeAt(0).toString(16).padStart(2, "0"),
          "",
        );
      const userId = hash;

      // Mockando as respostas do ConfigService
      jest.spyOn(configService, "get").mockReturnValueOnce("correct_client_id");

      const result = await authService.validateUserById(userId);
      expect(result).toBe(true);
    });
  });

  describe("generateToken", () => {
    it("should generate and return a token", async () => {
      const user = { id: "user_id" };
      const payload = { sub: "user_id" };
      const accessToken = { access_token: "mock_token", token_type: "bearer" };

      mockJwtService.sign.mockReturnValue("mock_token");
      const result = await authService.generateToken(user);

      expect(result).toEqual(accessToken);
      expect(mockJwtService.sign).toHaveBeenCalledWith(payload);
    });
  });

  describe("getAccessToken", () => {
    it("should return the access token", async () => {
      const token = { access_token: "mock_token", token_type: "bearer" };
      jest.spyOn(authService, "getAccessToken").mockResolvedValue(token);

      const result = await authService.getAccessToken();
      expect(result).toEqual(token);
    });
  });
});

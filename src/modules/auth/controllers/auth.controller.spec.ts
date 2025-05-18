import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "@auth/controllers/auth.controller";
import { AuthService } from "@auth/services/auth.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
class MockConfigService {
  get(key: string): string {
    if (key === "client_id") return "correct_client_id";
    if (key === "client_secret") return "correct_client_secret";
    return "";
  }
}
describe("AuthController", () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtService,
        {
          provide: ConfigService,
          useClass: MockConfigService, // Usando a classe mockada
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
  describe("", () => {
    it("should return authentication result when valid credentials are provided", async () => {
      const mockAuthService = {
        validate: jest.fn().mockResolvedValue({ token: "valid-token" }),
      };
      const authController = new AuthController(mockAuthService as any);
      const body = { client_id: "test-client", client_secret: "test-secret" };
      const result = await authController.auth(body);
      expect(mockAuthService.validate).toHaveBeenCalledWith(
        "test-client",
        "test-secret",
      );
      expect(result).toEqual({ token: "valid-token" });
    });
  });
});

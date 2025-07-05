import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "@auth/services/auth.service";
import { IToken } from "@common/interface/acessToken.interface";

describe("AuthController", () => {
  let authController: AuthController;
  let authService: AuthService;

  const mockAuthService: Partial<AuthService> = {
    validate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  describe("auth", () => {
    it("deve retornar um token válido ao receber credenciais válidas", () => {
      const body = { client_id: "valid-client", client_secret: "valid-secret" };
      const expectedToken: IToken = {
        access_token: "mock_token",
        token_type: "Bearer",
        expires_in: "2025-07-05T03:50:32.000Z",
        issued: "2025-07-05T03:50:32.000Z",
      };

      jest.spyOn(authService, "validate").mockReturnValue(expectedToken);

      const result = authController.auth(body);

      expect(result).toEqual(expectedToken);
      expect(authService.validate).toHaveBeenCalledWith(
        "valid-client",
        "valid-secret",
      );
    });
  });
});

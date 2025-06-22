import { JwtStrategy } from "./jwt.strategy";
import { AuthService } from "../services/auth.service";
import { UnauthorizedException } from "@nestjs/common";
jest.mock("@config/configService", () => ({
  configService: {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === "client_secret") return "my-secret-key";
      return null;
    }),
  },
}));
describe("JwtStrategy", () => {
  let jwtStrategy: JwtStrategy;
  let authService: AuthService;

  beforeEach(() => {
    authService = {
      validateUserById: jest.fn(),
    } as any;

    jwtStrategy = new JwtStrategy(authService);
  });

  describe("validate", () => {
    it("should return user if validateUserById returns a user", () => {
      const mockUser = { id: "123", name: "Test User" };
      (authService.validateUserById as jest.Mock).mockReturnValue(mockUser);

      const result = jwtStrategy.validate({ sub: "123" });
      expect(authService.validateUserById).toHaveBeenCalledWith("123");
      expect(result).toEqual(mockUser);
    });

    it("should throw UnauthorizedException if user is not found", () => {
      (authService.validateUserById as jest.Mock).mockReturnValue(null);

      expect(() => jwtStrategy.validate({ sub: "123" })).toThrow(
        UnauthorizedException,
      );
      expect(authService.validateUserById).toHaveBeenCalledWith("123");
    });
  });
});

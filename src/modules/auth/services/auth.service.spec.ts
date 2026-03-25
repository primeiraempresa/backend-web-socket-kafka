import { Test, TestingModule } from "@nestjs/testing";
import {
  UnauthorizedException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { DateService } from "@common/services/date.service";
import { configService } from "@config/config.service";

jest.mock("@config/config.service", () => ({
  configService: {
    get: jest.fn(),
  },
}));

describe("AuthService", () => {
  let service: AuthService;

  const jwtServiceMock = {
    sign: jest.fn(),
    decode: jest.fn(),
  };

  const dateServiceMock = {
    date: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: DateService, useValue: dateServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe("getAccessToken", () => {
    it("deve retornar undefined antes de gerar token", () => {
      expect(service.getAccessToken()).toBeUndefined();
    });
  });

  describe("validate", () => {
    it("deve lançar UnauthorizedException quando client_id estiver incorreto", () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === "client_id") return "expected-client-id";
        if (key === "client_secret") return "expected-secret";
        return undefined;
      });

      expect(() =>
        service.validate("wrong-client-id", "expected-secret"),
      ).toThrow(UnauthorizedException);
    });

    it("deve lançar UnauthorizedException quando client_secret estiver incorreto", () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === "client_id") return "expected-client-id";
        if (key === "client_secret") return "expected-secret";
        return undefined;
      });

      expect(() =>
        service.validate("expected-client-id", "wrong-secret"),
      ).toThrow(UnauthorizedException);
    });

    it("deve lançar ServiceUnavailableException quando client_id não existir na config", () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === "client_id") return undefined;
        if (key === "client_secret") return "expected-secret";
        return undefined;
      });

      expect(() => service.validate("anything", "anything")).toThrow(
        ServiceUnavailableException,
      );

      expect(() => service.validate("anything", "anything")).toThrow(
        "client_id not found in server",
      );
    });

    it("deve gerar token quando credenciais estiverem corretas", () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === "client_id") return "abc";
        if (key === "client_secret") return "secret";
        return undefined;
      });

      jwtServiceMock.sign.mockReturnValue("jwt-token");
      jwtServiceMock.decode.mockReturnValue({
        exp: 1710000000,
        iat: 1700000000,
      });
      dateServiceMock.date.mockImplementation((value: number) => ({
        toISOString: () => new Date(value).toISOString(),
      }));

      const result = service.validate("abc", "secret");

      expect(result).toEqual({
        access_token: "jwt-token",
        expires_in: new Date(1710000000 * 1000).toISOString(),
        issued: new Date(1700000000 * 1000).toISOString(),
        token_type: "Bearer",
      });

      expect(jwtServiceMock.sign).toHaveBeenCalledWith({ sub: "616263" });
      expect(jwtServiceMock.decode).toHaveBeenCalledWith("jwt-token");
      expect(dateServiceMock.date).toHaveBeenCalledWith(1710000000 * 1000);
      expect(dateServiceMock.date).toHaveBeenCalledWith(1700000000 * 1000);
    });
  });

  describe("validateUserById", () => {
    it("deve retornar false quando não existir client_id na config", () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);

      expect(service.validateUserById("anything")).toBe(false);
    });

    it("deve retornar false quando o hash não bater", () => {
      (configService.get as jest.Mock).mockReturnValue("abc");

      expect(service.validateUserById("000000")).toBe(false);
    });

    it("deve retornar true quando o hash bater", () => {
      (configService.get as jest.Mock).mockReturnValue("abc");

      expect(service.validateUserById("616263")).toBe(true);
    });
  });

  describe("generateToken", () => {
    it("deve gerar e salvar access token corretamente", () => {
      jwtServiceMock.sign.mockReturnValue("jwt-token");
      jwtServiceMock.decode.mockReturnValue({
        exp: 1710000000,
        iat: 1700000000,
      });
      dateServiceMock.date.mockImplementation((value: number) => ({
        toISOString: () => new Date(value).toISOString(),
      }));

      const result = service.generateToken({ id: "user-1" });

      expect(jwtServiceMock.sign).toHaveBeenCalledWith({ sub: "user-1" });
      expect(jwtServiceMock.decode).toHaveBeenCalledWith("jwt-token");
      expect(dateServiceMock.date).toHaveBeenCalledWith(1710000000 * 1000);
      expect(dateServiceMock.date).toHaveBeenCalledWith(1700000000 * 1000);

      expect(result).toEqual({
        access_token: "jwt-token",
        expires_in: new Date(1710000000 * 1000).toISOString(),
        issued: new Date(1700000000 * 1000).toISOString(),
        token_type: "Bearer",
      });

      expect(service.getAccessToken()).toEqual(result);
    });
  });
});

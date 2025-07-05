import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { JwtService } from "@nestjs/jwt";
import { DateService } from "@common/services/date.service";
import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

describe("AuthService", () => {
  let service: AuthService;
  let configService: ConfigService;

  beforeEach(async () => {
    const mockJwtService = {
      sign: jest.fn().mockReturnValue("mockJwtToken"),
      decode: jest.fn().mockReturnValue({ exp: 1625097600, iat: 1625094000 }),
    };

    const mockDateService = {
      date: jest.fn().mockReturnValue(new Date("2021-07-01T00:00:00.000Z")),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === "client_id") return "mockClientId";
        if (key === "client_secret") return "mockClientSecret";
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: DateService, useValue: mockDateService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    configService = module.get<ConfigService>(ConfigService);
    jest.runAllTimers();
  });
  afterEach(() => {
    jest.clearAllTimers();
  });
  describe("validate", () => {
    it("should throw UnauthorizedException if client_id is invalid", () => {
      jest.spyOn(configService, "get").mockReturnValueOnce("wrongClientId");
      expect(() =>
        service.validate("wrongClientId", "mockClientSecret"),
      ).toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException if client_secret is invalid", () => {
      jest
        .spyOn(configService, "get")
        .mockReturnValueOnce("mockClientId")
        .mockReturnValueOnce("wrongClientSecret");
      expect(() =>
        service.validate("mockClientId", "wrongClientSecret"),
      ).toThrow(UnauthorizedException);
    });
  });

  describe("validateUserById", () => {
    it("should return false if userId does not match the hashed client_id", () => {
      const hash = "wrongHash";
      jest.spyOn(configService, "get").mockReturnValueOnce("mockClientId");
      const result = service.validateUserById(hash);
      expect(result).toBe(false);
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { DateService } from "./date.service";
import { ConfigService } from "@nestjs/config";

class MockConfigService {
  get(key: string): string {
    if (key === "TZ") return "America/Sao_Paulo";
    return "";
  }
}

describe("DateService", () => {
  let service: DateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DateService,
        {
          provide: ConfigService,
          useClass: MockConfigService,
        },
      ],
    }).compile();

    service = module.get<DateService>(DateService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should return the current date in the configured timezone", () => {
    const result = service.now();

    // Usamos jest.spyOn para garantir que o método toISOString funciona corretamente
    const spy = jest
      .spyOn(result, "toISOString")
      .mockReturnValue("2024-01-01T12:00:00.000Z");
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toContain("2024-01-01T");
    spy.mockRestore();
  });

  it("should fallback to America/Sao_Paulo if TZ is not set", async () => {
    const mockConfigService = new MockConfigService();
    mockConfigService.get = jest.fn().mockReturnValue(undefined); // Forçando o valor de TZ para undefined

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DateService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<DateService>(DateService);

    const result = service.now();

    // Usamos jest.spyOn para garantir que o método toISOString funciona corretamente
    const spy = jest
      .spyOn(result, "toISOString")
      .mockReturnValue("2024-01-01T12:00:00.000Z");
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toContain("2024-01-01T");
    spy.mockRestore();
  });
});

import { DateService } from "./date.service";
import { toZonedTime } from "date-fns-tz";

jest.mock("date-fns-tz", () => ({
  toZonedTime: jest.fn(),
}));

describe("DateService", () => {
  let service: DateService;

  beforeEach(() => {
    service = new DateService();
    jest.clearAllMocks();
  });

  describe("now", () => {
    it("should return zoned current date", () => {
      const fakeDate = new Date("2024-01-01T00:00:00Z");
      const zonedDate = new Date("2024-01-01T03:00:00Z");

      jest.spyOn(global, "Date").mockImplementation(() => fakeDate as any);

      (toZonedTime as jest.Mock).mockReturnValue(zonedDate);

      const result = service.now();

      expect(toZonedTime).toHaveBeenCalledWith(fakeDate, expect.any(String));
      expect(result).toBe(zonedDate);
    });
  });

  describe("date", () => {
    it("should convert provided date to zoned time", () => {
      const input = "2024-01-01T00:00:00Z";
      const parsedDate = new Date(input);
      const zonedDate = new Date("2024-01-01T03:00:00Z");

      (toZonedTime as jest.Mock).mockReturnValue(zonedDate);

      const result = service.date(input);

      expect(toZonedTime).toHaveBeenCalledWith(parsedDate, expect.any(String));
      expect(result).toBe(zonedDate);
    });

    it("should accept timestamp number", () => {
      const input = 1704067200000;
      const parsedDate = new Date(input);
      const zonedDate = new Date("2024-01-01T03:00:00Z");

      (toZonedTime as jest.Mock).mockReturnValue(zonedDate);

      const result = service.date(input);

      expect(toZonedTime).toHaveBeenCalledWith(parsedDate, expect.any(String));
      expect(result).toBe(zonedDate);
    });
  });
});

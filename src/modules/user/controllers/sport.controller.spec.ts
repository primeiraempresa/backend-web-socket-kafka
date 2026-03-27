import { Test, TestingModule } from "@nestjs/testing";
import { SportsCotroller } from "./sport.controller";
import { SportService } from "@user/services/sport.service";
import { Sports } from "@user/models/sports.model";
import { SportDTO } from "@user/dto/sport.dto";

describe("SportsCotroller", () => {
  let controller: SportsCotroller;
  let service: SportService;

  const mockSportService = {
    getSports: jest.fn(),
    createSports: jest.fn(),
    updateSport: jest.fn(),
    deleteSport: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SportsCotroller],
      providers: [
        {
          provide: SportService,
          useValue: mockSportService,
        },
      ],
    }).compile();

    controller = module.get<SportsCotroller>(SportsCotroller);
    service = module.get<SportService>(SportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getSports", () => {
    it("should return all sports", async () => {
      const result = [{ id: "1", name: "Soccer" }];

      mockSportService.getSports.mockResolvedValue(result);

      expect(await controller.getSports()).toBe(result);
      expect(service.getSports).toHaveBeenCalledTimes(1);
    });
  });

  describe("postSports", () => {
    it("should create a sport", async () => {
      const body: Sports = { name: "Tennis" } as Sports;
      const result = { id: "1", ...body };

      mockSportService.createSports.mockResolvedValue(result);

      expect(await controller.postSports(body)).toBe(result);
      expect(service.createSports).toHaveBeenCalledWith(body);
    });
  });

  describe("putSport", () => {
    it("should update a sport", async () => {
      const id = "1";
      const body: SportDTO = { name: "Basketball" } as SportDTO;
      const result = { id, ...body };

      mockSportService.updateSport.mockResolvedValue(result);

      expect(await controller.putSport(id, body)).toBe(result);
      expect(service.updateSport).toHaveBeenCalledWith(id, body);
    });
  });

  describe("deleteSport", () => {
    it("should delete a sport", async () => {
      const id = "1";

      mockSportService.deleteSport.mockResolvedValue({
        deleted: true,
      });

      expect(await controller.deleteSport(id)).toEqual({ deleted: true });
      expect(service.deleteSport).toHaveBeenCalledWith(id);
    });
  });
});

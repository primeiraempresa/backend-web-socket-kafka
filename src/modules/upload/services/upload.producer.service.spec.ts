import { Test, TestingModule } from "@nestjs/testing";
import { ClientKafka } from "@nestjs/microservices";
import { UploadProducerService } from "./upload.producer.service";

describe("UploadProducerService", () => {
  let service: UploadProducerService;
  let clientKafka: ClientKafka;

  const clientKafkaMock = {
    subscribeToResponseOf: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadProducerService,
        {
          provide: "UPLOAD_MODULE",
          useValue: clientKafkaMock,
        },
      ],
    }).compile();

    service = module.get<UploadProducerService>(UploadProducerService);
    clientKafka = module.get<ClientKafka>("UPLOAD_MODULE");

    jest.clearAllMocks();
  });

  describe("onModuleInit", () => {
    it("should subscribe to topics and connect", async () => {
      await service.onModuleInit();

      expect(clientKafka.subscribeToResponseOf).toHaveBeenCalledWith(
        "upload.create",
      );
      expect(clientKafka.subscribeToResponseOf).toHaveBeenCalledWith(
        "upload.delete",
      );
      expect(clientKafka.connect).toHaveBeenCalled();
    });
  });

  describe("onModuleDestroy", () => {
    it("should close the client connection", async () => {
      await service.onModuleDestroy();
      expect(clientKafka.close).toHaveBeenCalled();
    });
  });

  describe("sendMessage", () => {
    it("should emit message to the correct topic", () => {
      const topic = "upload.create";
      const message = { test: "data" };

      service.sendMessage(topic, message);

      expect(clientKafka.emit).toHaveBeenCalledWith(topic, message);
    });
  });
});

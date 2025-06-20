import { Test, TestingModule } from "@nestjs/testing";
import { ChatProducerService } from "./chat.producer.service";
import { ClientKafka } from "@nestjs/microservices";
import { of } from "rxjs";

describe("ChatProducerService", () => {
  let service: ChatProducerService<any>;
  let clientKafka: ClientKafka;

  const mockClientKafka = {
    subscribeToResponseOf: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn().mockReturnValue(of({})),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatProducerService,
        {
          provide: "CHAT_MODULE",
          useValue: mockClientKafka,
        },
      ],
    }).compile();

    service = module.get<ChatProducerService<any>>(ChatProducerService);
    clientKafka = module.get<ClientKafka>("CHAT_MODULE");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("onModuleInit", () => {
    it("should subscribe to all topics and connect", async () => {
      await service.onModuleInit();

      expect(clientKafka.subscribeToResponseOf).toHaveBeenCalledTimes(8);
      expect(clientKafka.subscribeToResponseOf).toHaveBeenCalledWith(
        "chat.create",
      );
      expect(clientKafka.subscribeToResponseOf).toHaveBeenCalledWith(
        "chat.delete",
      );
      expect(clientKafka.subscribeToResponseOf).toHaveBeenCalledWith(
        "chat.message.create",
      );
      expect(clientKafka.subscribeToResponseOf).toHaveBeenCalledWith(
        "chat.message.update",
      );
      expect(clientKafka.subscribeToResponseOf).toHaveBeenCalledWith(
        "chat.message.delete",
      );
      expect(clientKafka.subscribeToResponseOf).toHaveBeenCalledWith(
        "chat.message.create.pending",
      );
      expect(clientKafka.subscribeToResponseOf).toHaveBeenCalledWith(
        "chat.message.update.pending",
      );
      expect(clientKafka.subscribeToResponseOf).toHaveBeenCalledWith(
        "chat.message.delete.pending",
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
    it("should emit message to given topic", () => {
      const topic = "chat.create";
      const message = { id: "123", content: "Hello" };

      const result = service.sendMessage(topic, message);

      expect(clientKafka.emit).toHaveBeenCalledWith(topic, message);
      expect(result).toBeInstanceOf(Object); // Verifica se retorna um Observable
    });
  });
});

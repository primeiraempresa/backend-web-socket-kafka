import { Test, TestingModule } from "@nestjs/testing";
import { firstValueFrom, of } from "rxjs";

import { ChatProducerService } from "./chat.producer.service";

describe("ChatProducerService", () => {
  let service: ChatProducerService;

  const mockClientKafka = {
    subscribeToResponseOf: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
  };

  const topics = [
    "chat.create",
    "chat.delete",
    "chat.message.create",
    "chat.message.update",
    "chat.message.delete",
    "chat.message.create.pending",
    "chat.message.update.pending",
    "chat.message.delete.pending",
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatProducerService,
        {
          provide: "CHAT_MODULE",
          useValue: mockClientKafka,
        },
      ],
    }).compile();

    service = module.get(ChatProducerService);
  });

  describe("onModuleInit", () => {
    it("deve subscrever todos os tópicos e conectar no Kafka", async () => {
      await service.onModuleInit();

      expect(mockClientKafka.subscribeToResponseOf).toHaveBeenCalledTimes(
        topics.length,
      );

      topics.forEach((topic) => {
        expect(mockClientKafka.subscribeToResponseOf).toHaveBeenCalledWith(
          topic,
        );
      });

      expect(mockClientKafka.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe("onModuleDestroy", () => {
    it("deve fechar a conexão do Kafka", async () => {
      await service.onModuleDestroy();

      expect(mockClientKafka.close).toHaveBeenCalledTimes(1);
    });
  });

  describe("sendMessage", () => {
    it("deve emitir a mensagem no tópico informado e retornar um Observable", async () => {
      const topic = "chat.create";
      const payload = { id: "123", content: "Hello" };

      mockClientKafka.emit.mockReturnValue(of({ ok: true }));

      const result$ = service.sendMessage(topic, payload);

      expect(mockClientKafka.emit).toHaveBeenCalledWith(topic, payload);

      await expect(firstValueFrom(result$)).resolves.toEqual({ ok: true });
    });
  });
});

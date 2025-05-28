import { Test, TestingModule } from "@nestjs/testing";
import { ChatController } from "../controllers/chat.controller";
import { ChatService } from "../services/chat.service";
import { ChatProducerService } from "../services/chat.producer.service";
import { CommonService } from "@common/services/common.service";
import { BadRequestException } from "@nestjs/common";

describe("ChatController", () => {
  let controller: ChatController;
  let chatService: jest.Mocked<ChatService>;
  let chatProducer: jest.Mocked<ChatProducerService<any>>;
  let commonService: jest.Mocked<CommonService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: {
            getMessages: jest.fn(),
            getChatByUsersIds: jest.fn(),
            getMessageById: jest.fn(),
          },
        },
        {
          provide: CommonService,
          useValue: {
            validateArryByMongoIDs: jest.fn(),
            validateMongoID: jest.fn(),
          },
        },
        {
          provide: "ChatProducerService_createChat",
          useValue: { sendMessage: jest.fn() },
        },
        {
          provide: "ChatProducerService_createMessage",
          useValue: { sendMessage: jest.fn() },
        },
        {
          provide: "ChatProducerService_updateMessage",
          useValue: { sendMessage: jest.fn() },
        },
        {
          provide: "ChatProducerService_deleteMessage",
          useValue: { sendMessage: jest.fn() },
        },
        {
          provide: "ChatProducerService_deleteChat",
          useValue: { sendMessage: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    chatService = module.get(ChatService);
    chatProducer = module.get("ChatProducerService_createChat");
    commonService = module.get(CommonService);
  });

  describe("getAllChats", () => {
    it("should return paginated chats", async () => {
      const result = { items: [], total: 0 };
      chatService.getMessages.mockResolvedValue(result as any);

      expect(await controller.getAllChats("chatId", 1, 10)).toEqual(result);
      expect(chatService.getMessages).toHaveBeenCalledWith("chatId", 1, 10);
    });
  });

  describe("getChatByUsersIdsOrById", () => {
    it("should return a chat document", async () => {
      const chat = { _id: "chatId" };
      chatService.getChatByUsersIds.mockResolvedValue(chat as any);

      expect(
        await controller.getChatByUsersIdsOrById(["user1", "user2"], undefined),
      ).toEqual(chat);
      expect(chatService.getChatByUsersIds).toHaveBeenCalledWith(
        ["user1", "user2"],
        undefined,
      );
    });
  });

  describe("getMessages", () => {
    it("should return a message document", async () => {
      const message = { _id: "msgId" };
      chatService.getMessageById.mockResolvedValue(message as any);

      expect(await controller.getMessages("chatId", "msgId")).toEqual(message);
      expect(chatService.getMessageById).toHaveBeenCalledWith(
        "chatId",
        "msgId",
      );
    });
  });

  describe("createChat", () => {
    it("should throw BadRequestException if userIds are invalid", () => {
      commonService.validateArryByMongoIDs.mockReturnValue(false);

      expect(() =>
        controller.createChat({ chatters: ["invalidId"] } as any),
      ).toThrow(BadRequestException);
    });

    it("should create chat", () => {
      commonService.validateArryByMongoIDs.mockReturnValue(true);
      chatProducer.sendMessage.mockReturnValue("created");

      expect(
        controller.createChat({ chatters: ["userId1", "userId2"] } as any),
      ).toEqual("created");
      expect(chatProducer.sendMessage).toHaveBeenCalledWith("chat.create", {
        chatters: ["userId1", "userId2"],
      });
    });
  });

  describe("createMessage", () => {
    it("should throw BadRequestException if chatId is invalid", () => {
      commonService.validateMongoID.mockReturnValue(false);

      expect(() =>
        controller.createMessage("invalidChatId", { message: "Hello" } as any),
      ).toThrow(BadRequestException);
    });

    it("should create a message", () => {
      commonService.validateMongoID.mockReturnValue(true);
      const producer = module.get("ChatProducerService_createMessage");
      producer.sendMessage.mockReturnValue("message created");

      expect(
        controller.createMessage("chatId", { message: "Hello" } as any),
      ).toEqual("message created");
    });
  });

  describe("updateMessage", () => {
    it("should update a message", async () => {
      chatService.getMessageById.mockResolvedValue({ _id: "msgId" } as any);
      const producer = module.get("ChatProducerService_updateMessage");
      producer.sendMessage.mockResolvedValue("updated");

      const result = await controller.updateMessage("chatId", "msgId", {
        content: "Updated",
      } as any);

      expect(result).toBe("updated");
      expect(chatService.getMessageById).toHaveBeenCalledWith(
        "chatId",
        "msgId",
      );
      expect(producer.sendMessage).toHaveBeenCalledWith("chat.message.update", {
        chatId: "chatId",
        messageId: "msgId",
        body: { content: "Updated" },
      });
    });
  });

  describe("deleteMessage", () => {
    it("should throw BadRequestException if chatId or messageId are invalid", () => {
      commonService.validateMongoID.mockReturnValue(false);

      expect(() => controller.deleteMessage("invalid", "invalid")).toThrow(
        BadRequestException,
      );
    });

    it("should delete a message", () => {
      commonService.validateMongoID.mockReturnValue(true);
      const producer = module.get("ChatProducerService_deleteMessage");
      producer.sendMessage.mockReturnValue("deleted");

      const result = controller.deleteMessage("chatId", "msgId");
      expect(result).toBe("deleted");
    });
  });

  describe("deleteChat", () => {
    it("should delete a chat", async () => {
      chatService.getChatByUsersIds.mockResolvedValue({ _id: "chatId" } as any);
      const producer = module.get("ChatProducerService_deleteChat");
      producer.sendMessage.mockResolvedValue("deleted");

      const result = await controller.deleteChat("chatId");
      expect(result).toBe("deleted");
      expect(chatService.getChatByUsersIds).toHaveBeenCalledWith([], "chatId");
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { ChatController } from "../controllers/chat.controller";
import { ChatService } from "../services/chat.service";
import { CommonService } from "@common/services/common.service";
import { BadRequestException } from "@nestjs/common";
import { of } from "rxjs";

describe("ChatController", () => {
  let controller: ChatController;
  let chatService: jest.Mocked<ChatService>;
  let commonService: jest.Mocked<CommonService>;
  const producerMock = () => ({
    sendMessage: jest.fn(),
  });

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
        { provide: "ChatProducerService_createChat", useFactory: producerMock },
        {
          provide: "ChatProducerService_createMessage",
          useFactory: producerMock,
        },
        {
          provide: "ChatProducerService_updateMessage",
          useFactory: producerMock,
        },
        {
          provide: "ChatProducerService_deleteMessage",
          useFactory: producerMock,
        },
        { provide: "ChatProducerService_deleteChat", useFactory: producerMock },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    chatService = module.get(ChatService);
    commonService = module.get(CommonService);
    (controller as any).chatProducerService_createChat = module.get(
      "ChatProducerService_createChat",
    );
    (controller as any).chatProducerService_createMessage = module.get(
      "ChatProducerService_createMessage",
    );
    (controller as any).chatProducerService_updateMessage = module.get(
      "ChatProducerService_updateMessage",
    );
    (controller as any).chatProducerService_deleteMessage = module.get(
      "ChatProducerService_deleteMessage",
    );
    (controller as any).chatProducerService_deleteChat = module.get(
      "ChatProducerService_deleteChat",
    );
  });

  describe("getAllChats", () => {
    it("should return paginated chat messages", async () => {
      const result = { items: [], total: 0 };
      chatService.getMessages.mockResolvedValue(result as any);

      expect(await controller.getAllChats("chatId", 1, 10)).toBe(result);
      expect(chatService.getMessages).toHaveBeenCalledWith("chatId", 1, 10);
    });
  });

  describe("getChatByUsersIdsOrById", () => {
    it("should return chat document", async () => {
      const chat = { _id: "chatId" };
      chatService.getChatByUsersIds.mockResolvedValue(chat as any);
      const result = await controller.getChatByUsersIdsOrById(
        ["user1", "user2"],
        "chatId",
      );
      expect(result).toEqual(chat);
      expect(chatService.getChatByUsersIds).toHaveBeenCalledWith(
        ["user1", "user2"],
        "chatId",
      );
    });
  });

  describe("getMessages", () => {
    it("should return a message document", async () => {
      const message = { _id: "messageId" };
      chatService.getMessageById.mockResolvedValue(message as any);

      const result = await controller.getMessages("chatId", "messageId");
      expect(result).toEqual(message);
      expect(chatService.getMessageById).toHaveBeenCalledWith(
        "chatId",
        "messageId",
      );
    });
  });

  describe("createChat", () => {
    it("should throw if user IDs are invalid", () => {
      commonService.validateArryByMongoIDs.mockReturnValue(false);
      expect(() => controller.createChat({ chatters: [] } as any)).toThrow(
        BadRequestException,
      );
    });

    it("should send create chat message", () => {
      commonService.validateArryByMongoIDs.mockReturnValue(true);
      const sendMessage = (controller as any).chatProducerService_createChat
        .sendMessage;
      sendMessage.mockReturnValue(of({}));

      const result = controller.createChat({ chatters: ["user1"] } as any);
      expect(sendMessage).toHaveBeenCalledWith("chat.create", {
        chatters: ["user1"],
      });
      expect(result).toBeInstanceOf(Object);
    });
  });

  describe("createMessage", () => {
    it("should throw if chat ID is invalid", () => {
      commonService.validateMongoID.mockReturnValue(false);
      expect(() => controller.createMessage("invalidId", {} as any)).toThrow(
        BadRequestException,
      );
    });

    it("should send create message event", () => {
      commonService.validateMongoID.mockReturnValue(true);
      const sendMessage = (controller as any).chatProducerService_createMessage
        .sendMessage;
      sendMessage.mockReturnValue(of({}));

      const result = controller.createMessage("chatId", {
        text: "Hello",
      } as any);
      expect(sendMessage).toHaveBeenCalledWith("chat.message.create", {
        chatId: "chatId",
        chat_conversation: { text: "Hello" },
      });
      expect(result).toBeInstanceOf(Object);
    });
  });

  describe("updateMessage", () => {
    it("should update message", async () => {
      chatService.getMessageById.mockResolvedValue({} as any);
      const sendMessage = (controller as any).chatProducerService_updateMessage
        .sendMessage;
      sendMessage.mockReturnValue(of({}));

      const result = await controller.updateMessage("chatId", "messageId", {
        text: "Updated",
      } as any);
      expect(chatService.getMessageById).toHaveBeenCalledWith(
        "chatId",
        "messageId",
      );
      expect(sendMessage).toHaveBeenCalledWith("chat.message.update", {
        chatId: "chatId",
        messageId: "messageId",
        chat_conversation: { text: "Updated" },
      });
      expect(result).toBeInstanceOf(Object);
    });
  });

  describe("deleteMessage", () => {
    it("should throw if ids are invalid", () => {
      commonService.validateMongoID.mockReturnValue(false);
      expect(() => controller.deleteMessage("chatId", "messageId")).toThrow(
        BadRequestException,
      );
    });

    it("should delete message", () => {
      commonService.validateMongoID.mockReturnValue(true);
      const sendMessage = (controller as any).chatProducerService_deleteMessage
        .sendMessage;
      sendMessage.mockReturnValue(of({}));

      const result = controller.deleteMessage("chatId", "messageId");
      expect(sendMessage).toHaveBeenCalledWith("chat.message.delete", {
        chatId: "chatId",
        messageId: "messageId",
      });
      expect(result).toBeInstanceOf(Object);
    });
  });

  describe("deleteChat", () => {
    it("should delete chat", async () => {
      chatService.getChatByUsersIds.mockResolvedValue({} as any);
      const sendMessage = (controller as any).chatProducerService_deleteChat
        .sendMessage;
      sendMessage.mockReturnValue(of({}));

      const result = await controller.deleteChat("chatId");
      expect(chatService.getChatByUsersIds).toHaveBeenCalledWith([], "chatId");
      expect(sendMessage).toHaveBeenCalledWith("chat.delete", {
        chatId: "chatId",
      });
      expect(result).toBeInstanceOf(Object);
    });
  });
});

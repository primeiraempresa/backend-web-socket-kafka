import { Test, TestingModule } from "@nestjs/testing";
import { ChatController } from "../controllers/chat.controller";
import { ChatService } from "../services/chat.service";
import { CommonService } from "@common/services/common.service";
import { of } from "rxjs";
import { BadRequestException } from "@nestjs/common";

import {
  CHAT_PRODUCER_SERVICE_CREATE_CHAT,
  CHAT_PRODUCER_SERVICE_CREATE_MESSAGE,
  CHAT_PRODUCER_SERVICE_DELETE_CHAT,
  CHAT_PRODUCER_SERVICE_DELETE_MESSAGE,
  CHAT_PRODUCER_SERVICE_UPDATE_MESSAGE,
} from "@common/tokens/chat.tokens";

describe("ChatController", () => {
  let controller: ChatController;
  let chatService: jest.Mocked<ChatService>;
  let commonService: jest.Mocked<CommonService>;

  const mockProducer = {
    sendMessage: jest.fn(),
  };

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
        { provide: CHAT_PRODUCER_SERVICE_CREATE_CHAT, useValue: mockProducer },
        {
          provide: CHAT_PRODUCER_SERVICE_CREATE_MESSAGE,
          useValue: mockProducer,
        },
        {
          provide: CHAT_PRODUCER_SERVICE_UPDATE_MESSAGE,
          useValue: mockProducer,
        },
        {
          provide: CHAT_PRODUCER_SERVICE_DELETE_MESSAGE,
          useValue: mockProducer,
        },
        { provide: CHAT_PRODUCER_SERVICE_DELETE_CHAT, useValue: mockProducer },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    chatService = module.get(ChatService);
    commonService = module.get(CommonService);
    jest.clearAllMocks();
  });

  describe("getAllChats", () => {
    it("should return chat pagination", async () => {
      const result = { items: [], total: 0 };
      chatService.getMessages.mockResolvedValue(result as any);

      const response = await controller.getAllChats("chatId", 1, 10);

      expect(response).toBe(result);
      expect(chatService.getMessages).toHaveBeenCalledWith("chatId", 1, 10);
    });
  });

  describe("getChatByUsersIdsOrById", () => {
    it("should return chat by chat_id or userIds", async () => {
      const chat = { _id: "chatId" };
      chatService.getChatByUsersIds.mockResolvedValue(chat as any);

      const result = await controller.getChatByUsersIdsOrById(
        ["user1", "user2"],
        "chatId",
      );

      expect(result).toBe(chat);
      expect(chatService.getChatByUsersIds).toHaveBeenCalledWith(
        ["user1", "user2"],
        "chatId",
      );
    });
  });

  describe("getMessages", () => {
    it("should return message by id", async () => {
      const message = { _id: "messageId" };
      chatService.getMessageById.mockResolvedValue(message as any);

      const result = await controller.getMessages("chatId", "messageId");

      expect(result).toBe(message);
      expect(chatService.getMessageById).toHaveBeenCalledWith(
        "chatId",
        "messageId",
      );
    });
  });

  describe("createChat", () => {
    it("should create a chat", () => {
      commonService.validateArryByMongoIDs.mockReturnValue(true);
      mockProducer.sendMessage.mockReturnValue(of({ id: "chatId" }));

      const result = controller.createChat({
        chatters: ["user1", "user2"],
      } as any);

      expect(result).toBeInstanceOf(Object);
      expect(commonService.validateArryByMongoIDs).toHaveBeenCalled();
      expect(mockProducer.sendMessage).toHaveBeenCalledWith("chat.create", {
        chatters: ["user1", "user2"],
      });
    });

    it("should throw BadRequestException if userIds are invalid", () => {
      commonService.validateArryByMongoIDs.mockReturnValue(false);

      expect(() =>
        controller.createChat({ chatters: ["invalidId"] } as any),
      ).toThrow(BadRequestException);
    });
  });

  describe("createMessage", () => {
    it("should create a message", () => {
      commonService.validateMongoID.mockReturnValue(true);
      mockProducer.sendMessage.mockReturnValue(of({ id: "messageId" }));

      const result = controller.createMessage("chatId", {
        message: "Hello",
      } as any);

      expect(result).toBeInstanceOf(Object);
      expect(mockProducer.sendMessage).toHaveBeenCalledWith(
        "chat.message.create",
        {
          chatId: "chatId",
          chat_conversation: { message: "Hello" },
        },
      );
    });

    it("should throw BadRequestException if chatId is invalid", () => {
      commonService.validateMongoID.mockReturnValue(false);

      expect(() =>
        controller.createMessage("invalidChatId", { message: "Hello" } as any),
      ).toThrow(BadRequestException);
    });
  });

  describe("updateMessage", () => {
    it("should update a message", async () => {
      chatService.getMessageById.mockResolvedValue({} as any);
      mockProducer.sendMessage.mockReturnValue(of({ id: "messageId" }));

      const result = await controller.updateMessage("chatId", "messageId", {
        message: "Updated",
      } as any);

      expect(result).toBeInstanceOf(Object);
      expect(chatService.getMessageById).toHaveBeenCalledWith(
        "chatId",
        "messageId",
      );
      expect(mockProducer.sendMessage).toHaveBeenCalledWith(
        "chat.message.update",
        {
          chatId: "chatId",
          messageId: "messageId",
          chat_conversation: { message: "Updated" },
        },
      );
    });
  });

  describe("deleteMessage", () => {
    it("should delete a message", () => {
      commonService.validateMongoID.mockReturnValue(true);
      mockProducer.sendMessage.mockReturnValue(of({ id: "messageId" }));

      const result = controller.deleteMessage("chatId", "messageId");

      expect(result).toBeInstanceOf(Object);
      expect(mockProducer.sendMessage).toHaveBeenCalledWith(
        "chat.message.delete",
        {
          chatId: "chatId",
          messageId: "messageId",
        },
      );
    });

    it("should throw BadRequestException if chatId or messageId is invalid", () => {
      commonService.validateMongoID.mockReturnValue(false);

      expect(() => controller.deleteMessage("invalidId", "invalidId")).toThrow(
        BadRequestException,
      );
    });
  });

  describe("deleteChat", () => {
    it("should delete a chat", async () => {
      chatService.getChatByUsersIds.mockResolvedValue({} as any);
      mockProducer.sendMessage.mockReturnValue(of({ chatId: "chatId" }));

      const result = await controller.deleteChat("chatId");

      expect(result).toBeInstanceOf(Object);
      expect(chatService.getChatByUsersIds).toHaveBeenCalledWith([], "chatId");
      expect(mockProducer.sendMessage).toHaveBeenCalledWith("chat.delete", {
        chatId: "chatId",
      });
    });
  });
});

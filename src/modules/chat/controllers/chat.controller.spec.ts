import { Test, TestingModule } from "@nestjs/testing";
import { ChatController } from "./chat.controller";
import { ChatService } from "../services/chat.service";
import { CommonService } from "@common/services/common.service";
import { BadRequestException } from "@nestjs/common";

describe("ChatController", () => {
  let controller: ChatController;
  let chatService: Partial<Record<keyof ChatService, jest.Mock>>;
  let commonService: Partial<Record<keyof CommonService, jest.Mock>>;

  beforeEach(async () => {
    chatService = {
      getMessages: jest.fn(),
      getChatByUsersIds: jest.fn(),
      getMessageById: jest.fn(),
      createChat: jest.fn(),
      addMessage: jest.fn(),
      updateMessageById: jest.fn(),
      deleteMessageById: jest.fn(),
      deleteChatById: jest.fn(),
      getChatsByUserId: jest.fn(),
    };

    commonService = {
      validateMongoID: jest.fn(),
      validateArryByMongoIDs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        { provide: ChatService, useValue: chatService },
        { provide: CommonService, useValue: commonService },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
  });

  describe("getAllChats", () => {
    it("should return chat messages with pagination", async () => {
      const result = { data: [], total: 0, page: 1, perPage: 10 };
      chatService.getMessages?.mockResolvedValue(result);

      const response = await controller.getAllChats("123", 1, 10);
      expect(response).toEqual(result);
      expect(chatService.getMessages).toHaveBeenCalledWith("123", 1, 10);
    });
  });

  describe("getChatByUsersIdsOrById", () => {
    it("should return a chat by user IDs", async () => {
      const chat = { _id: "chat1", chatters: [] };
      chatService.getChatByUsersIds?.mockResolvedValue(chat);

      const response = await controller.getChatByUsersIdsOrById([
        "user1",
        "user2",
      ]);
      expect(response).toEqual(chat);
    });
  });

  describe("getChatsByUserId", () => {
    it("should return chats for the given user ID", async () => {
      const userId = "abc123";
      const chats = [{ id: "chat1" }, { id: "chat2" }];

      chatService.getChatsByUserId?.mockResolvedValue(chats);

      const result = await controller.getChatsByUserId(userId);

      expect(chatService.getChatsByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual(chats);
    });
  });

  describe("getMessages", () => {
    it("should return a specific message", async () => {
      const message = { _id: "msg1", text: "Hello" };
      chatService.getMessageById?.mockResolvedValue(message);

      const result = await controller.getMessages("chat1", "msg1");
      expect(result).toEqual(message);
    });
  });

  describe("createChat", () => {
    it("should throw BadRequestException for invalid userIds", () => {
      commonService.validateArryByMongoIDs?.mockReturnValue(false);
      const body = { chatters: ["invalidId"] };

      expect(() => controller.createChat(body)).toThrow(BadRequestException);
    });

    it("should create a chat with valid IDs", async () => {
      commonService.validateArryByMongoIDs?.mockReturnValue(true);
      const chat = { _id: "chat1" };
      chatService.createChat?.mockResolvedValue(chat);

      const result = await controller.createChat({ chatters: ["validId"] });
      expect(result).toEqual(chat);
    });
  });

  describe("createMessage", () => {
    it("should throw BadRequestException for invalid chat ID", () => {
      commonService.validateMongoID?.mockReturnValue(false);
      expect(() =>
        controller.createMessage("invalid", { content: "Hi" } as any),
      ).toThrow(BadRequestException);
    });

    it("should add a message", async () => {
      commonService.validateMongoID?.mockReturnValue(true);
      const message = { _id: "msg1" };
      chatService.addMessage?.mockResolvedValue(message);

      const result = await controller.createMessage("chat1", {
        content: "Hello",
      } as any);
      expect(result).toEqual(message);
    });
  });

  describe("updateMessage", () => {
    it("should update a message by ID", async () => {
      chatService.getMessageById?.mockResolvedValue({ _id: "msg1" });
      chatService.updateMessageById?.mockResolvedValue({
        _id: "msg1",
        text: "Updated",
      });

      const result: any = await controller.updateMessage("chat1", "msg1", {
        text: "Updated",
      } as any);
      expect(result.text).toBe("Updated");
    });
  });

  describe("deleteMessage", () => {
    it("should throw BadRequestException for invalid IDs", () => {
      commonService.validateMongoID?.mockReturnValue(false);

      expect(() => controller.deleteMessage("badId", "badId")).toThrow(
        BadRequestException,
      );
    });

    it("should delete a message with valid IDs", async () => {
      commonService.validateMongoID?.mockReturnValue(true);
      chatService.deleteMessageById?.mockResolvedValue({ _id: "msg1" });

      const result = await controller.deleteMessage("chat1", "msg1");
      expect(result._id).toBe("msg1");
    });
  });

  describe("deleteChat", () => {
    it("should delete chat by ID", async () => {
      chatService.getChatByUsersIds?.mockResolvedValue({ _id: "chat1" });
      chatService.deleteChatById?.mockResolvedValue({ deleted: true });

      const result = await controller.deleteChat("chat1");
      expect(result).toEqual({ deleted: true });
    });
  });
});

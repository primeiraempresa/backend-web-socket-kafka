import { Test, TestingModule } from "@nestjs/testing";
import { ChatController } from "./chat.controller";
import { ChatService } from "../../services/chat.service";
import { ChatDocument } from "../../schemas/chat.schema";
import { ChatConversationDocument } from "../../schemas/chat_conversation.schema";
import { ChatPagination } from "../../models/chatPagination.model";
import { Chat_conversation_DTO } from "../../dto/chat_conversation.dto";

describe("ChatController", () => {
  let controller: ChatController;
  let service: ChatService;

  const mockChatService = {
    getMessages: jest.fn(),
    getChatByUsersIds: jest.fn(),
    getMessageById: jest.fn(),
    updateMessageById: jest.fn(),
    deleteMessageById: jest.fn(),
    deleteChatById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: mockChatService,
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    service = module.get<ChatService>(ChatService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getAllChats", () => {
    it("should return paginated messages", async () => {
      const result = {
        items: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: 1,
        nextPage: null,
      } as ChatPagination;

      jest.spyOn(service, "getMessages").mockResolvedValue(result);
      expect(await controller.getAllChats("chat123", 1, 10)).toEqual(result);
      expect(service.getMessages).toHaveBeenCalledWith("chat123", 1, 10);
    });
  });

  describe("getChatByUsersIdsOrById", () => {
    it("should return chat by users or ID", async () => {
      const mockChat = {} as ChatDocument;
      jest.spyOn(service, "getChatByUsersIds").mockResolvedValue(mockChat);

      const result = await controller.getChatByUsersIdsOrById(
        ["user1", "user2"],
        "chat_id",
      );
      expect(result).toBe(mockChat);
      expect(service.getChatByUsersIds).toHaveBeenCalledWith(
        ["user1", "user2"],
        "chat_id",
      );
    });
  });

  describe("getMessages", () => {
    it("should return a message by ID", async () => {
      const mockMessage = {} as ChatConversationDocument;
      jest.spyOn(service, "getMessageById").mockResolvedValue(mockMessage);

      const result = await controller.getMessages("chat123", "msg456");
      expect(result).toBe(mockMessage);
      expect(service.getMessageById).toHaveBeenCalledWith("chat123", "msg456");
    });
  });

  describe("updateMessage", () => {
    it("should update a message", async () => {
      const dto: Chat_conversation_DTO = { message: "Updated" };
      const mockUpdatedMessage = {
        message: "Updated",
      } as ChatConversationDocument;
      jest
        .spyOn(service, "updateMessageById")
        .mockResolvedValue(mockUpdatedMessage);

      const result = await controller.updateMessage("chat123", "msg456", dto);
      expect(result).toBe(mockUpdatedMessage);
      expect(service.updateMessageById).toHaveBeenCalledWith(
        "chat123",
        "msg456",
        dto,
      );
    });
  });

  describe("deleteMessage", () => {
    it("should delete a message", async () => {
      const mockDeletedMessage = {} as ChatConversationDocument;
      jest
        .spyOn(service, "deleteMessageById")
        .mockResolvedValue(mockDeletedMessage);

      const result = await controller.deleteMessage("chat123", "msg456");
      expect(result).toBe(mockDeletedMessage);
      expect(service.deleteMessageById).toHaveBeenCalledWith(
        "chat123",
        "msg456",
      );
    });
  });

  describe("deleteChat", () => {
    it("should delete a chat", async () => {
      const mockDeletedChat = {} as ChatDocument;
      jest.spyOn(service, "deleteChatById").mockResolvedValue(mockDeletedChat);

      const result = await controller.deleteChat("chat123");
      expect(result).toBe(mockDeletedChat);
      expect(service.deleteChatById).toHaveBeenCalledWith("chat123");
    });
  });
});

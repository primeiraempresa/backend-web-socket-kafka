import { Test, TestingModule } from "@nestjs/testing";
import { ChatConsumerController } from "./chat.consumer.controller";
import { ChatService } from "@chat/services/chat.service";
import { WebSocketService } from "@common/services/webSocket.service";
import { ChatProducerService } from "@chat/services/chat.producer.service";
import { Queue } from "bull";
import { getQueueToken } from "@nestjs/bull";
import * as bcrypt from "bcryptjs";
import { DateService } from "@common/services/date.service";

describe("ChatConsumerController", () => {
  let controller: ChatConsumerController;
  let chatService: jest.Mocked<ChatService>;
  let chatProducerService: ChatProducerService;
  let chatWebSocketService: jest.Mocked<WebSocketService>;
  let queueMock: jest.Mocked<Queue>;
  const mockDate = new Date("2023-01-01T00:00:00.000Z");
  const mockMessage = {
    userId: "user123",
    chat_conversation: "Hello world",
  } as any;
  const dateServiceMock = {
    now: jest.fn().mockReturnValue(mockDate),
  };
  beforeEach(async () => {
    queueMock = {
      add: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatConsumerController],
      providers: [
        {
          provide: ChatService,
          useValue: {
            createChat: jest.fn(),
            deleteChatById: jest.fn(),
            addMessage: jest.fn(),
            getChatByUsersIds: jest.fn(),
            updateMessageById: jest.fn(),
            deleteMessageById: jest.fn(),
          },
        },
        {
          provide: getQueueToken("chat"),
          useValue: queueMock,
        },
        {
          provide: ChatProducerService,
          useValue: {
            sendMessage: jest.fn(),
          },
        },
        {
          provide: WebSocketService,
          useValue: {
            sendToUser: jest.fn(),
            getUserIdByID_online: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: DateService,
          useValue: dateServiceMock,
        },
      ],
    }).compile();
    controller = module.get<ChatConsumerController>(ChatConsumerController);
    chatService = module.get(ChatService);
    chatWebSocketService = module.get(WebSocketService);
    chatProducerService = module.get(ChatProducerService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
  it("should queue message if user is offline", async () => {
    chatWebSocketService.getUserIdByID_online.mockImplementation(
      (id) => id === "user1",
    );

    const message = {
      userId: "user1",
      chatId: "chat1",
      chat_conversation: { text: "Hello" } as any,
    };

    const result = { _id: "msg1", text: "Hello" } as any;

    const chat = {
      _id: "chat1",
      chatters: [{ _id: "user1" }, { _id: "user2" }],
    } as any;

    chatService.addMessage.mockResolvedValue(result);
    chatService.getChatByUsersIds.mockResolvedValue(chat);

    await controller.handleMessageCreate(message);

    expect(chatProducerService.sendMessage).toHaveBeenCalledWith(
      "chat.message.create.pending",
      expect.objectContaining({
        userId: "user2",
        chatId: "chat1",
        chat_conversation: result,
      }),
    );
  });

  describe("handleChatCreate", () => {
    it("should create a chat and send to websocket", async () => {
      const message = {
        userId: "user1",
        chats: { chatters: ["user1", "user2"] },
      } as any;
      const result = { _id: "chat1" } as any;
      chatService.createChat.mockResolvedValue(result);

      const response = await controller.handleChatCreate(message);

      expect(chatService.createChat).toHaveBeenCalledWith(["user1", "user2"]);
      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "chat.create",
        result,
      );
      expect(response).toEqual(result);
    });
  });

  describe("handleChatDelete", () => {
    it("should delete a chat and send to websocket", async () => {
      const message = { userId: "user1", chatId: "chat1" };
      const result = { _id: "chat1" } as any;
      chatService.deleteChatById.mockResolvedValue(result);

      const response = await controller.handleChatDelete(message);

      expect(chatService.deleteChatById).toHaveBeenCalledWith("chat1");
      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "chat.delete",
        result,
      );
      expect(response).toEqual(result);
    });
  });

  describe("handleMessageCreate", () => {
    it("should create a message and send it to all users via websocket", async () => {
      const message = {
        userId: "user1",
        chatId: "chat1",
        chat_conversation: { text: "Hello" } as any,
      };

      const result = { _id: "msg1", text: "Hello" } as any;

      const chat = {
        _id: "chat1",
        chatters: [{ _id: "user1" }, { _id: "user2" }],
      } as any;

      chatService.addMessage.mockResolvedValue(result);
      chatService.getChatByUsersIds.mockResolvedValue(chat);

      const response = await controller.handleMessageCreate(message);

      expect(chatService.addMessage).toHaveBeenCalledWith("chat1", {
        text: "Hello",
      });

      expect(chatService.getChatByUsersIds).toHaveBeenCalledWith([], "chat1");

      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "chat.message.create",
        result,
      );
      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user2",
        "chat.message.create",
        result,
      );

      expect(response).toEqual(result);
    });

    it("should handle and return errors properly", async () => {
      const message = {
        userId: "user1",
        chatId: "chat1",
        chat_conversation: { text: "Hello" } as any,
      };

      const error = {
        response: { message: "Something went wrong" },
      };

      chatService.addMessage.mockRejectedValue(error);

      const response = await controller.handleMessageCreate(message);

      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "error",
        error.response,
      );
      expect(response).toEqual(error.response);
    });
  });

  describe("handleMessageUpdate", () => {
    it("should update a message and send to all chat users via websocket", async () => {
      const message = {
        userId: "user1",
        chatId: "chat1",
        messageId: "msg1",
        chat_conversation: { text: "Updated" } as any,
      };

      const result = { _id: "msg1", text: "Updated" } as any;

      const chat = {
        _id: "chat1",
        chatters: [{ _id: "user1" }, { _id: "user2" }],
      } as any;

      chatService.updateMessageById.mockResolvedValue(result);
      chatService.getChatByUsersIds.mockResolvedValue(chat);

      const response = await controller.handleMessageUpdate(message);

      expect(chatService.updateMessageById).toHaveBeenCalledWith(
        "chat1",
        "msg1",
        { text: "Updated" },
      );

      expect(chatService.getChatByUsersIds).toHaveBeenCalledWith([], "chat1");

      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "chat.message.update",
        result,
      );
      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user2",
        "chat.message.update",
        result,
      );

      expect(response).toEqual(result);
    });

    it("should handle and return errors properly", async () => {
      const message = {
        userId: "user1",
        chatId: "chat1",
        messageId: "msg1",
        chat_conversation: { text: "Updated" } as any,
      };

      const error = { response: { message: "Update failed" } };

      chatService.updateMessageById.mockRejectedValue(error);

      const response = await controller.handleMessageUpdate(message);

      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "error",
        error.response,
      );

      expect(response).toEqual(error.response);
    });
  });

  describe("handleMessageDelete", () => {
    it("should delete a message and send to all chat users via websocket", async () => {
      const message = {
        userId: "user1",
        chatId: "chat1",
        messageId: "msg1",
      };

      const result = { _id: "msg1" } as any;

      const chat = {
        _id: "chat1",
        chatters: [{ _id: "user1" }, { _id: "user2" }],
      } as any;

      chatService.deleteMessageById.mockResolvedValue(result);
      chatService.getChatByUsersIds.mockResolvedValue(chat);

      const response = await controller.handleMessageDelete(message);

      expect(chatService.deleteMessageById).toHaveBeenCalledWith(
        "chat1",
        "msg1",
      );

      expect(chatService.getChatByUsersIds).toHaveBeenCalledWith([], "chat1");

      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "chat.message.delete",
        result,
      );
      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user2",
        "chat.message.delete",
        result,
      );

      expect(response).toEqual(result);
    });

    it("should handle and return errors properly", async () => {
      const message = {
        userId: "user1",
        chatId: "chat1",
        messageId: "msg1",
      };

      const error = { response: { message: "Delete failed" } };
      chatService.deleteMessageById.mockRejectedValue(error);

      const response = await controller.handleMessageDelete(message);

      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "error",
        error.response,
      );

      expect(response).toEqual(error.response);
    });
  });
  describe("handleMessageCreatepending", () => {
    it("should add job to queue with correct name and jobId", async () => {
      const fixedDate = "2023-01-01T00:00:00.000Z";
      const mockedHash = "mockedHash123";

      dateServiceMock.now.mockReturnValue(new Date(fixedDate));

      const bcryptSpy = jest
        .spyOn(bcrypt as any, "hash")
        .mockResolvedValue(mockedHash);

      await controller.handleMessageCreatepending(mockMessage);

      expect(bcryptSpy).toHaveBeenCalledWith(fixedDate, 10);

      expect(queueMock.add).toHaveBeenCalledWith(
        "chat.message.create",
        mockMessage,
        {
          jobId: `chat.message.create.${mockMessage.userId}-${mockedHash}`,
        },
      );
    });
  });

  describe("handleMessageUpdatepending", () => {
    it("should add job to queue with correct name and jobId", async () => {
      const fixedDate = "2023-01-01T00:00:00.000Z";
      const mockedHash = "mockedHash123";

      dateServiceMock.now.mockReturnValue(new Date(fixedDate));

      const bcryptSpy = jest
        .spyOn(bcrypt as any, "hash")
        .mockResolvedValue(mockedHash);

      await controller.handleMessageUpdatepending(mockMessage);

      expect(bcryptSpy).toHaveBeenCalledWith(fixedDate, 10);

      expect(queueMock.add).toHaveBeenCalledWith(
        "chat.message.update",
        mockMessage,
        {
          jobId: `chat.message.update.${mockMessage.userId}-${mockedHash}`,
        },
      );
    });
  });

  describe("handleMessageDeletepending", () => {
    it("should add job to queue with correct name and jobId", async () => {
      const fixedDate = "2023-01-01T00:00:00.000Z";
      const mockedHash = "mockedHash123";

      dateServiceMock.now.mockReturnValue(new Date(fixedDate));

      const bcryptSpy = jest
        .spyOn(bcrypt as any, "hash")
        .mockResolvedValue(mockedHash);

      await controller.handleMessageDeletepending(mockMessage);

      expect(bcryptSpy).toHaveBeenCalledWith(fixedDate, 10);

      expect(queueMock.add).toHaveBeenCalledWith(
        "chat.message.delete",
        mockMessage,
        {
          jobId: `chat.message.delete.${mockMessage.userId}-${mockedHash}`,
        },
      );
    });
  });
});

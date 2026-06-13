import { Test, TestingModule } from "@nestjs/testing";
import { ChatConsumerController } from "./chat.consumer.controller";
import { ChatService } from "@chat/services/chat.service";
import { WebSocketService } from "@common/services/webSocket.service";
import { ChatProducerService } from "@chat/services/chat.producer.service";
import { UploadProducerService } from "@upload/services/upload.producer.service";
import { Queue } from "bull";
import { getQueueToken } from "@nestjs/bull";
import { getConnectionToken, getModelToken } from "@nestjs/mongoose";
import { Chats } from "@chat/models/chat.model";
import * as bcrypt from "bcryptjs";
import { DateService } from "@common/services/date.service";

describe("ChatConsumerController", () => {
  let controller: ChatConsumerController;
  let chatService: jest.Mocked<ChatService>;
  let chatProducerService: jest.Mocked<ChatProducerService>;
  let uploadProducerService: jest.Mocked<UploadProducerService>;
  let chatWebSocketService: jest.Mocked<WebSocketService>;
  let queueMock: jest.Mocked<Queue>;
  let connectionMock: any;
  let chatModelMock: any;

  const mockDate = new Date("2023-01-01T00:00:00.000Z");
  const mockMessage = {
    userId: "user123",
    chat_conversation: "Hello world",
  } as any;

  const dateServiceMock = {
    now: jest.fn().mockReturnValue(mockDate),
  };

  beforeEach(async () => {
    queueMock = { add: jest.fn() } as any;
    connectionMock = { dropCollection: jest.fn() };
    chatModelMock = { findByIdAndDelete: jest.fn() };

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
            getMessages: jest.fn(),
          },
        },
        {
          provide: getQueueToken("chat"),
          useValue: queueMock,
        },
        {
          provide: ChatProducerService,
          useValue: { sendMessage: jest.fn() },
        },
        {
          provide: UploadProducerService,
          useValue: { sendMessage: jest.fn() },
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
        {
          provide: getConnectionToken("ChatsConnection"),
          useValue: connectionMock,
        },
        {
          provide: getModelToken(Chats.name, "Datas"),
          useValue: chatModelMock,
        },
      ],
    }).compile();

    controller = module.get<ChatConsumerController>(ChatConsumerController);
    chatService = module.get(ChatService);
    chatWebSocketService = module.get(WebSocketService);
    chatProducerService = module.get(ChatProducerService);
    uploadProducerService = module.get(UploadProducerService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
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

    it("should handle error with response", async () => {
      const message = {
        userId: "user1",
        chats: { chatters: ["user1"] },
      } as any;
      const error = { response: { message: "Chat error" } };
      chatService.createChat.mockRejectedValue(error);

      const response = await controller.handleChatCreate(message);

      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "error",
        error.response,
      );
      expect(response).toEqual(error.response);
    });

    it("should handle error without response", async () => {
      const message = {
        userId: "user1",
        chats: { chatters: ["user1"] },
      } as any;
      const error = new Error("Raw error");
      chatService.createChat.mockRejectedValue(error);

      const response = await controller.handleChatCreate(message);

      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "error",
        error,
      );
      expect(response).toEqual(error);
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

    it("should handle error with response", async () => {
      const message = { userId: "user1", chatId: "chat1" };
      const error = { response: { message: "Delete failed" } };
      chatService.deleteChatById.mockRejectedValue(error);

      const response = await controller.handleChatDelete(message);

      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "error",
        error.response,
      );
      expect(response).toEqual(error.response);
    });

    it("should handle error without response", async () => {
      const message = { userId: "user1", chatId: "chat1" };
      const error = new Error("Raw error");
      chatService.deleteChatById.mockRejectedValue(error);

      const response = await controller.handleChatDelete(message);

      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "error",
        error,
      );
      expect(response).toEqual(error);
    });
  });

  describe("handleMessageCreate", () => {
    it("should create a message and send to all online users", async () => {
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

    it("should queue message for offline users", async () => {
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

      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "chat.message.create",
        result,
      );
      expect(chatProducerService.sendMessage).toHaveBeenCalledWith(
        "chat.message.create.pending",
        {
          userId: "user2",
          chatId: "chat1",
          chat_conversation: result,
        },
      );
    });

    it("should handle error with response", async () => {
      const message = {
        userId: "user1",
        chatId: "chat1",
        chat_conversation: { text: "Hello" } as any,
      };
      const error = { response: { message: "Something went wrong" } };
      chatService.addMessage.mockRejectedValue(error);

      const response = await controller.handleMessageCreate(message);

      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "error",
        error.response,
      );
      expect(response).toEqual(error.response);
    });

    it("should handle error without response", async () => {
      const message = {
        userId: "user1",
        chatId: "chat1",
        chat_conversation: { text: "Hello" } as any,
      };
      const error = new Error("Raw error");
      chatService.addMessage.mockRejectedValue(error);

      const response = await controller.handleMessageCreate(message);

      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "error",
        error,
      );
      expect(response).toEqual(error);
    });
  });

  describe("handleMessageUpdate", () => {
    it("should update a message and send to all online users", async () => {
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

    it("should queue message for offline users", async () => {
      chatWebSocketService.getUserIdByID_online.mockImplementation(
        (id) => id === "user1",
      );

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

      await controller.handleMessageUpdate(message);

      expect(chatProducerService.sendMessage).toHaveBeenCalledWith(
        "chat.message.update.pending",
        {
          userId: "user2",
          chatId: "chat1",
          chat_conversation: result,
        },
      );
    });

    it("should handle error with response", async () => {
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

    it("should handle error without response", async () => {
      const message = {
        userId: "user1",
        chatId: "chat1",
        messageId: "msg1",
        chat_conversation: { text: "Updated" } as any,
      };
      const error = new Error("Raw error");
      chatService.updateMessageById.mockRejectedValue(error);

      const response = await controller.handleMessageUpdate(message);

      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "error",
        error,
      );
      expect(response).toEqual(error);
    });
  });

  describe("handleMessageDelete", () => {
    it("should delete a message and send to all online users", async () => {
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

    it("should queue message for offline users", async () => {
      chatWebSocketService.getUserIdByID_online.mockImplementation(
        (id) => id === "user1",
      );

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

      await controller.handleMessageDelete(message);

      expect(chatProducerService.sendMessage).toHaveBeenCalledWith(
        "chat.message.delete.pending",
        {
          userId: "user2",
          chatId: "chat1",
          chat_conversation: result,
        },
      );
    });

    it("should handle error with response", async () => {
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

    it("should handle error without response", async () => {
      const message = {
        userId: "user1",
        chatId: "chat1",
        messageId: "msg1",
      };
      const error = new Error("Raw error");
      chatService.deleteMessageById.mockRejectedValue(error);

      const response = await controller.handleMessageDelete(message);

      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "error",
        error,
      );
      expect(response).toEqual(error);
    });
  });

  describe("handleMessageCreatePending", () => {
    it("should add job to queue with correct name and jobId", async () => {
      const fixedDate = "2023-01-01T00:00:00.000Z";
      const mockedHash = "mockedHash123";

      dateServiceMock.now.mockReturnValue(new Date(fixedDate));
      jest.spyOn(bcrypt as any, "hash").mockResolvedValue(mockedHash);

      await controller.handleMessageCreatePending(mockMessage);

      expect(bcrypt.hash).toHaveBeenCalledWith(fixedDate, 10);
      expect(queueMock.add).toHaveBeenCalledWith(
        "chat.message.create",
        mockMessage,
        {
          jobId: `chat.message.create.${mockMessage.userId}-${mockedHash}`,
        },
      );
    });
  });

  describe("handleMessageUpdatePending", () => {
    it("should add job to queue with correct name and jobId", async () => {
      const fixedDate = "2023-01-01T00:00:00.000Z";
      const mockedHash = "mockedHash123";

      dateServiceMock.now.mockReturnValue(new Date(fixedDate));
      jest.spyOn(bcrypt as any, "hash").mockResolvedValue(mockedHash);

      await controller.handleMessageUpdatePending(mockMessage);

      expect(bcrypt.hash).toHaveBeenCalledWith(fixedDate, 10);
      expect(queueMock.add).toHaveBeenCalledWith(
        "chat.message.update",
        mockMessage,
        {
          jobId: `chat.message.update.${mockMessage.userId}-${mockedHash}`,
        },
      );
    });
  });

  describe("handleMessageDeletePending", () => {
    it("should add job to queue with correct name and jobId", async () => {
      const fixedDate = "2023-01-01T00:00:00.000Z";
      const mockedHash = "mockedHash123";

      dateServiceMock.now.mockReturnValue(new Date(fixedDate));
      jest.spyOn(bcrypt as any, "hash").mockResolvedValue(mockedHash);

      await controller.handleMessageDeletePending(mockMessage);

      expect(bcrypt.hash).toHaveBeenCalledWith(fixedDate, 10);
      expect(queueMock.add).toHaveBeenCalledWith(
        "chat.message.delete",
        mockMessage,
        {
          jobId: `chat.message.delete.${mockMessage.userId}-${mockedHash}`,
        },
      );
    });
  });

  describe("handleMessageDeleteProcess", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    afterAll(() => {
      consoleSpy.mockRestore();
    });

    it("should paginate messages, send deletions to upload producer, drop collection and delete chat", async () => {
      const chatId = "chat123";
      const chat = {
        _id: chatId,
        chatters: [],
        toJSON: () => ({ _id: chatId }),
      };

      chatService.getChatByUsersIds.mockResolvedValue(chat as any);

      const page1Items = [
        {
          images: [
            { toJSON: () => ({ _id: "img1" }) },
            { toJSON: () => ({ _id: "img2" }) },
          ],
          file: { toJSON: () => ({ _id: "file1" }) },
        },
      ];
      const page2Items = [
        {
          images: null,
          file: null,
        },
      ];

      chatService.getMessages
        .mockResolvedValueOnce({
          items: page1Items,
          totalItems: 2,
          totalPages: 2,
          currentPage: 1,
          nextPage: 2,
        } as any)
        .mockResolvedValueOnce({
          items: page2Items,
          totalItems: 2,
          totalPages: 2,
          currentPage: 2,
          nextPage: null,
        } as any);

      await controller.handleMessageDeleteProcess(chatId);

      expect(chatService.getChatByUsersIds).toHaveBeenCalledWith(
        undefined,
        chatId,
      );
      expect(chatService.getMessages).toHaveBeenCalledWith(chatId, 1, 1);
      expect(chatService.getMessages).toHaveBeenCalledWith(chatId, 2, 1);
      expect(chatService.getMessages).toHaveBeenCalledTimes(2);

      expect(uploadProducerService.sendMessage).toHaveBeenCalledWith(
        "upload.delete.process",
        {
          images: [{ _id: "img1" }, { _id: "img2" }],
          file: { _id: "file1" },
        },
      );
      expect(uploadProducerService.sendMessage).toHaveBeenCalledWith(
        "upload.delete.process",
        {
          images: undefined,
          file: undefined,
        },
      );

      expect(connectionMock.dropCollection).toHaveBeenCalledWith(
        `ChatMessage_${chatId}`,
      );
      expect(chatModelMock.findByIdAndDelete).toHaveBeenCalledWith(chatId);
    });

    it("should handle single page without nextPage", async () => {
      const chatId = "chat456";
      const chat = {
        _id: chatId,
        toJSON: () => ({ _id: chatId }),
      };

      chatService.getChatByUsersIds.mockResolvedValue(chat as any);
      chatService.getMessages.mockResolvedValueOnce({
        items: [{ images: null, file: null }],
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        nextPage: null,
      } as any);

      await controller.handleMessageDeleteProcess(chatId);

      expect(chatService.getMessages).toHaveBeenCalledTimes(1);
      expect(connectionMock.dropCollection).toHaveBeenCalledWith(
        `ChatMessage_${chatId}`,
      );
      expect(chatModelMock.findByIdAndDelete).toHaveBeenCalledWith(chatId);
    });
  });
});

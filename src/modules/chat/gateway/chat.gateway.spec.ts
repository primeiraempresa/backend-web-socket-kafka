import { Test, TestingModule } from "@nestjs/testing";
import { ChatGateway } from "./chat.gateway";
import { ChatService } from "@chat/services/chat.service";
import { WebSocketService } from "@common/services/webSocket.service";
import { CommonService } from "@common/services/common.service";
import { UserService } from "@user/services/user.service";
import {
  CHAT_PRODUCER_SERVICE_CREATE_CHAT,
  CHAT_PRODUCER_SERVICE_CREATE_MESSAGE,
  CHAT_PRODUCER_SERVICE_DELETE_CHAT,
  CHAT_PRODUCER_SERVICE_DELETE_MESSAGE,
  CHAT_PRODUCER_SERVICE_UPDATE_MESSAGE,
} from "@common/tokens/chat.tokens";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { getQueueToken } from "@nestjs/bull";

describe("ChatGateway", () => {
  let gateway: ChatGateway;

  const mockQueue = {
    add: jest.fn(),
    getWaiting: jest.fn().mockResolvedValue([]),
    getDelayed: jest.fn().mockResolvedValue([]),
    getActive: jest.fn().mockResolvedValue([]),
  };
  const mockChatService = {
    getChatByUsersIds: jest.fn(),
    getMessages: jest.fn(),
    getMessageById: jest.fn(),
  };

  const mockProducer = {
    sendMessage: jest.fn(),
  };

  const mockChatWebSocketService = {
    addClient: jest.fn(),
    removeClient: jest.fn(),
    broadcast: jest.fn(),
    getUserIdBySocket: jest.fn(),
    setServer: jest.fn(),
    usersOnline: new Map<string, any>(),
  };

  const mockCommonService = {
    validateArryByMongoIDs: jest.fn(),
    validateMongoID: jest.fn(),
  };

  const mockUserService = {
    getUserByID: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === "URL") return "http://localhost:3000";
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: mockChatService },
        { provide: WebSocketService, useValue: mockChatWebSocketService },
        { provide: CommonService, useValue: mockCommonService },
        { provide: UserService, useValue: mockUserService },
        { provide: ConfigService, useValue: mockConfigService },
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
        { provide: getQueueToken("chat"), useValue: mockQueue },
        JwtService,
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
  });

  afterEach(() => jest.clearAllMocks());

  describe("getAllChats", () => {
    it("should return chat data successfully", async () => {
      const result = { id: "chat1" };
      mockChatService.getChatByUsersIds.mockResolvedValue(result);

      const response = await gateway.getAllChats({ userIds: ["user1"] });

      expect(response).toEqual({ event: "chat", data: result });
      expect(mockChatService.getChatByUsersIds).toHaveBeenCalledWith(
        ["user1"],
        undefined,
      );
    });

    it("should return error if chat service throws", async () => {
      mockChatService.getChatByUsersIds.mockRejectedValue({
        response: "error",
      });

      const response = await gateway.getAllChats({ userIds: ["user1"] });

      expect(response).toEqual({ event: "error", data: "error" });
    });
  });

  describe("getMessages", () => {
    it("should return messages successfully", async () => {
      const result = { messages: [] };
      mockChatService.getMessages.mockResolvedValue(result);

      const response = await gateway.getMessagens({
        chatId: "chat1",
        page: 1,
        perPage: 10,
      });

      expect(response).toEqual({ event: "chat.message", data: result });
      expect(mockChatService.getMessages).toHaveBeenCalledWith("chat1", 1, 10);
    });
  });

  describe("getMessageById", () => {
    it("should return message if found", async () => {
      const message = { id: "msg1", chatId: "chat1" };
      mockChatService.getMessageById.mockResolvedValue(message);

      const response = await gateway.getMessageById({
        chatId: "chat1",
        messageId: "msg1",
      });

      expect(response).toEqual({ event: "chat.message.id", data: message });
    });

    it("should return error if not found", async () => {
      mockChatService.getMessageById.mockRejectedValue({
        response: "Message not found",
      });

      const response = await gateway.getMessageById({
        chatId: "chat1",
        messageId: "msg1",
      });

      expect(response).toEqual({
        event: "error",
        data: "Message not found",
      });
    });
  });

  describe("createMessage", () => {
    it("should send message if sender is valid", () => {
      mockCommonService.validateMongoID.mockReturnValue(true);
      mockChatWebSocketService.getUserIdBySocket.mockReturnValue("user1");

      const client = {} as any;
      const message = {
        chatId: "chat1",
        chat_conversation: {
          sender: "user1",
          content: "hello",
        },
      };

      gateway.createMessage(message as any, client);

      expect(mockProducer.sendMessage).toHaveBeenCalledWith(
        "chat.message.create",
        {
          userId: "user1",
          chatId: "chat1",
          chat_conversation: message.chat_conversation,
        },
      );
    });

    it("should return error if sender is invalid", () => {
      mockCommonService.validateMongoID.mockReturnValue(false);

      const response = gateway.createMessage(
        {
          chatId: "chat1",
          chat_conversation: { sender: "invalid" },
        } as any,
        {} as any,
      );

      expect(response).toEqual({ error: "Invalid chatId" });
    });
  });
  describe("updateMessage", () => {
    it("should send update message if message exists", async () => {
      mockChatService.getMessageById.mockResolvedValue({});
      mockChatWebSocketService.getUserIdBySocket.mockReturnValue("user1");

      const data = {
        chatId: "chat1",
        messageId: "msg1",
        chat_conversation: { content: "updated" },
      } as any;

      await gateway.updateMessage(data, {} as any);

      expect(mockProducer.sendMessage).toHaveBeenCalledWith(
        "chat.message.update",
        {
          userId: "user1",
          ...data,
        },
      );
    });

    it("should return error if message not found", async () => {
      mockChatService.getMessageById.mockRejectedValue(new Error("Not found"));
      mockChatWebSocketService.getUserIdBySocket.mockReturnValue("user1");

      const response = await gateway.updateMessage(
        {
          chatId: "chat1",
          messageId: "msg1",
          chat_conversation: {},
        } as any,
        {} as any,
      );

      expect(response).toEqual({
        event: "error",
        data: "Message not found",
      });
    });
  });
  describe("deleteMessage", () => {
    it("should send delete message if IDs are valid", () => {
      mockCommonService.validateMongoID.mockReturnValue(true);
      mockChatWebSocketService.getUserIdBySocket.mockReturnValue("user1");

      gateway.deleteMessage({ chatId: "chat1", messageId: "msg1" }, {} as any);

      expect(mockProducer.sendMessage).toHaveBeenCalledWith(
        "chat.message.delete",
        {
          userId: "user1",
          chatId: "chat1",
          messageId: "msg1",
        },
      );
    });

    it("should return error if IDs are invalid", () => {
      mockCommonService.validateMongoID.mockReturnValue(false);

      const response = gateway.deleteMessage(
        { chatId: "invalid", messageId: "invalid" },
        {} as any,
      );

      expect(response).toEqual({ error: "Invalid chatId or messageId" });
    });
  });

  describe("createChat", () => {
    it("should create a chat when valid", () => {
      mockCommonService.validateArryByMongoIDs.mockReturnValue(true);
      mockChatWebSocketService.getUserIdBySocket.mockReturnValue("user1");

      const client = {};
      const chatData = { chatters: ["user2"] };

      gateway.createChat(chatData, client as any);

      expect(mockProducer.sendMessage).toHaveBeenCalledWith("chat.create", {
        userId: "user1",
        chats: chatData,
      });
    });

    it("should return error if chatters are invalid", () => {
      mockCommonService.validateArryByMongoIDs.mockReturnValue(false);

      const response = gateway.createChat({ chatters: ["invalid"] }, {} as any);

      expect(response).toEqual({ error: "Invalid userIds" });
    });
  });
  describe("deleteChat", () => {
    it("should send delete chat request", async () => {
      mockChatService.getChatByUsersIds.mockResolvedValue({});
      mockChatWebSocketService.getUserIdBySocket.mockReturnValue("user1");

      await gateway.deleteChat({ chatId: "chat1" }, {} as any);

      expect(mockProducer.sendMessage).toHaveBeenCalledWith("chat.delete", {
        userId: "user1",
        chatId: "chat1",
      });
    });
  });

  describe("handleConnection", () => {
    it("should close connection if userId is missing in URL", () => {
      const client = { close: jest.fn() };
      const req = {
        url: "ws://[::1]:3000/?wrongParam=value",
        headers: { authorization: "Bearer token" },
      };

      gateway.handleConnection(client as any, req as any);

      expect(client.close).toHaveBeenCalledWith(1008, "param userId not found");
    });

    it("should close connection if authorization header is missing", () => {
      const client = { close: jest.fn() };
      const req = { url: "ws://[::1]:3000/?userId=user1", headers: {} };

      gateway.handleConnection(client as any, req as any);

      expect(client.close).toHaveBeenCalledWith(1008, "param token not found");
    });

    it("should close connection if authorization header is invalid", () => {
      const client = { close: jest.fn() };
      const req = {
        url: "ws://[::1]:3000/?userId=user1",
        headers: { authorization: "InvalidToken" },
      };

      gateway.handleConnection(client as any, req as any);

      expect(client.close).toHaveBeenCalledWith(1008, "param token not found");
    });

    it("should close connection if user not found", async () => {
      const client = { close: jest.fn(), on: jest.fn() } as any;
      const req = {
        url: "ws://[::1]:3000/?token=valid.token.here",
      } as any;

      jest
        .spyOn(JwtService.prototype, "verify")
        .mockReturnValue({ sub: "notFoundUserId" });
      jest
        .spyOn(mockUserService, "getUserByID")
        .mockRejectedValue(new Error("User not found"));

      await gateway.handleConnection(client, req);

      expect(client.close).toHaveBeenCalledWith(1008, "param userId not found");
    });

    it("should connect and add client successfully", async () => {
      const client = { close: jest.fn(), on: jest.fn() } as any;
      const req = {
        url: "ws://[::1]:3000/?userId=validUserId&token=valid.token.here",
        headers: { authorization: "Bearer valid.token.here" },
      } as any;
      jest
        .spyOn(JwtService.prototype, "verify")
        .mockReturnValue({ sub: "validUserId" });
      jest
        .spyOn(mockUserService, "getUserByID")
        .mockResolvedValue({ id: "validUserId" });
      await gateway.handleConnection(client, req);
      expect(mockChatWebSocketService.addClient).toHaveBeenCalledWith(
        "validUserId",
        client,
      );
    });
  });

  describe("handleDisconnect", () => {
    it("should remove client and broadcast offline", () => {
      const client = {};
      const usersOnline = new Map<string, any>([["user1", client]]);
      mockChatWebSocketService.usersOnline = usersOnline;

      gateway.handleDisconnect(client as any);

      expect(mockChatWebSocketService.removeClient).toHaveBeenCalledWith(
        "user1",
      );
    });
  });
});

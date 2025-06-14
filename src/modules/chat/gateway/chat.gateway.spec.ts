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

describe("ChatGateway", () => {
  let gateway: ChatGateway;

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

  describe("handleConnection", () => {
    it("should close connection if userId is missing in URL", () => {
      const client = { close: jest.fn() };
      const req = {
        url: "/?wrongParam=value",
        headers: { authorization: "Bearer token" },
      };

      gateway.handleConnection(client as any, req as any);

      expect(client.close).toHaveBeenCalledWith(1008, "param userId not found");
    });

    it("should close connection if authorization header is missing", () => {
      const client = { close: jest.fn() };
      const req = { url: "/?userId=user1", headers: {} };

      gateway.handleConnection(client as any, req as any);

      expect(client.close).toHaveBeenCalledWith(
        1008,
        "Missing or invalid authorization header",
      );
    });

    it("should close connection if authorization header is invalid", () => {
      const client = { close: jest.fn() };
      const req = {
        url: "/?userId=user1",
        headers: { authorization: "InvalidToken" },
      };

      gateway.handleConnection(client as any, req as any);

      expect(client.close).toHaveBeenCalledWith(
        1008,
        "Missing or invalid authorization header",
      );
    });

    it("should close connection if user not found", async () => {
      const client = { close: jest.fn(), on: jest.fn() } as any;
      const req = {
        url: "/chat?userId=notFoundUserId",
        headers: { authorization: "Bearer valid.token.here" },
      } as any;

      jest
        .spyOn(JwtService.prototype, "verify")
        .mockReturnValue({ sub: "notFoundUserId" });
      jest
        .spyOn(mockUserService, "getUserByID")
        .mockRejectedValue(new Error("User not found"));

      await gateway.handleConnection(client, req);

      expect(client.close).toHaveBeenCalledWith(1008, "user not found");
    });

    it("should connect and add client successfully", async () => {
      const client = { close: jest.fn(), on: jest.fn() } as any;
      const req = {
        url: "/chat?userId=validUserId",
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
      expect(mockChatWebSocketService.broadcast).toHaveBeenCalledWith(
        "user.offline",
        {
          userId: "user1",
          status: "offline",
        },
      );
    });
  });
});

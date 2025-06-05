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
  usersOnline: new Map(),
};

const mockCommonService = {
  validateArryByMongoIDs: jest.fn(),
  validateMongoID: jest.fn(),
};

const mockUserService = {
  getUserByID: jest.fn(),
};
const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === "URL") {
      return "http://localhost:3000";
    }
    return null;
  }),
};
describe("ChatGateway", () => {
  let gateway: ChatGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: mockChatService },
        {
          provide: CHAT_PRODUCER_SERVICE_CREATE_CHAT,
          useValue: mockProducer,
        },
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
        {
          provide: CHAT_PRODUCER_SERVICE_DELETE_CHAT,
          useValue: mockProducer,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        { provide: WebSocketService, useValue: mockChatWebSocketService },
        { provide: CommonService, useValue: mockCommonService },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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

    it("should return error when chat service throws", async () => {
      const error = { response: "error" };
      mockChatService.getChatByUsersIds.mockRejectedValue(error);

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
    it("should create chat when valid", () => {
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
    it("should close connection if userId not found in URL", async () => {
      const client = { close: jest.fn() } as any;
      const req = { url: "/?wrongParam=value" } as any;

      await gateway.handleConnection(client, req);

      expect(client.close).toHaveBeenCalledWith(1008, "param userId not found");
    });

    it("should close connection if user not found", async () => {
      mockUserService.getUserByID.mockRejectedValue(new Error("Not found"));
      const client = { close: jest.fn(), on: jest.fn() } as any;
      const req = { url: "/?userId=user1" } as any;

      await gateway.handleConnection(client, req);

      expect(client.close).toHaveBeenCalledWith(1008, "user not found");
    });

    it("should add client on successful connection", async () => {
      mockUserService.getUserByID.mockResolvedValue({ id: "user1" });

      const client = { on: jest.fn() } as any;
      const req = { url: "/?userId=user1" } as any;

      await gateway.handleConnection(client, req);

      expect(mockChatWebSocketService.addClient).toHaveBeenCalledWith(
        "user1",
        client,
      );
      expect(mockChatWebSocketService.broadcast).toHaveBeenCalledWith(
        "user.online",
        {
          userId: "user1",
          status: "online",
        },
      );
    });
  });

  describe("handleDisconnect", () => {
    it("should remove client and broadcast offline status", () => {
      const client = {};
      const usersOnline = new Map([["user1", client as any]]);
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

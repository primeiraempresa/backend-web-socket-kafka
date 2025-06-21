import { Test, TestingModule } from "@nestjs/testing";
import { WebSocketService } from "./webSocket.service";
import { WebSocket, Server } from "ws";

describe("ChatWebSocketService", () => {
  let service: WebSocketService;

  const mockClient = {
    send: jest.fn(),
    readyState: WebSocket.OPEN,
    OPEN: WebSocket.OPEN,
  } as unknown as WebSocket;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebSocketService],
    }).compile();

    service = module.get<WebSocketService>(WebSocketService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.usersOnline.clear();
  });

  describe("setServer", () => {
    it("should set server instance", () => {
      const server = {} as Server;
      service.setServer(server);
      expect(service.server).toBe(server);
    });
  });

  describe("addClient", () => {
    it("should add client to usersOnline", () => {
      service.addClient("user1", mockClient);
      expect(service.usersOnline.get("user1")).toBe(mockClient);
    });
  });
  describe("getUserIdByID_online", () => {
    it("should return true if user is online", () => {
      service.addClient("user1", mockClient);
      expect(service.getUserIdByID_online("user1")).toBe(true);
    });

    it("should return false if user is not online", () => {
      expect(service.getUserIdByID_online("unknown")).toBe(false);
    });
  });
  describe("removeClient", () => {
    it("should remove client from usersOnline", () => {
      service.addClient("user1", mockClient);
      service.removeClient("user1");
      expect(service.usersOnline.has("user1")).toBe(false);
    });
  });
  describe("handleMessage - users.online", () => {
    it("should respond with list of online users", () => {
      service.addClient("user1", mockClient);

      const rawMessage = JSON.stringify({
        event: "users.online",
        data: { userId: "user1" },
      });

      service.handleMessage(mockClient, rawMessage);

      expect(mockClient.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: "users.online",
          data: { users: ["user1"] },
        }),
      );
    });
  });

  describe("sendToUser", () => {
    it("should send message to user if connected", () => {
      service.addClient("user1", mockClient);

      service.sendToUser("user1", "eventName", { foo: "bar" });

      expect(mockClient.send).toHaveBeenCalledWith(
        JSON.stringify({ event: "eventName", data: { foo: "bar" } }),
      );
    });

    it("should not send if user is not connected", () => {
      service.sendToUser("nonexistent", "eventName", { foo: "bar" });
      expect(mockClient.send).not.toHaveBeenCalled();
    });

    it("should not send if client is not OPEN", () => {
      const closedClient = {
        ...mockClient,
        readyState: WebSocket.CLOSED,
      } as unknown as WebSocket;

      service.addClient("user1", closedClient);
      service.sendToUser("user1", "eventName", { foo: "bar" });

      expect(closedClient.send).not.toHaveBeenCalled();
    });
  });

  describe("broadcast", () => {
    it("should broadcast message to all connected clients", () => {
      const mockClient2 = {
        send: jest.fn(),
        readyState: WebSocket.OPEN,
        OPEN: WebSocket.OPEN,
      } as unknown as WebSocket;

      service.addClient("user1", mockClient);
      service.addClient("user2", mockClient2);

      service.broadcast("broadcastEvent", { foo: "bar" });

      const message = JSON.stringify({
        event: "broadcastEvent",
        data: { foo: "bar" },
      });

      expect(mockClient.send).toHaveBeenCalledWith(message);
      expect(mockClient2.send).toHaveBeenCalledWith(message);
    });
  });

  describe("getUserIdBySocket", () => {
    it("should return userId for given socket", () => {
      service.addClient("user1", mockClient);

      const userId = service.getUserIdBySocket(mockClient);
      expect(userId).toBe("user1");
    });

    it("should return undefined if socket not found", () => {
      const userId = service.getUserIdBySocket(mockClient);
      expect(userId).toBeUndefined();
    });
  });
});

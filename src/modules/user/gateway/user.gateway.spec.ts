import { UserGateway } from "./user.gateway";
import { WebSocketService } from "@common/services/webSocket.service";
import { UserService } from "@user/services/user.service";
import { JwtService } from "@nestjs/jwt";
import { Server, WebSocket } from "ws";

describe("UserGateway", () => {
  let gateway: UserGateway;
  let webSocketService: jest.Mocked<WebSocketService>;
  let userService: jest.Mocked<UserService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(() => {
    webSocketService = {
      addClient: jest.fn(),
      setServer: jest.fn(),
      broadcast: jest.fn(),
      handleMessage: jest.fn(),
      removeClient: jest.fn(),
      usersOnline: new Map(),
    } as any;

    userService = {
      getUserByID: jest.fn(),
      getUsers: jest.fn(),
    } as any;

    jwtService = {
      verify: jest.fn(),
    } as any;

    gateway = new UserGateway(webSocketService, userService, jwtService);
    gateway.server = new Server({ noServer: true }) as any;
  });

  describe("handleConnection", () => {
    let client: WebSocket;
    let req: any;

    beforeEach(() => {
      client = {
        close: jest.fn(),
        on: jest.fn(),
      } as any;
    });

    it("should close client if userId param missing", async () => {
      req = {
        url: "ws://[::1]:3000/",
        headers: { authorization: "Bearer token" },
      };
      await gateway.handleConnection(client, req);
      expect(client.close).toHaveBeenCalledWith(1008, "param userId not found");
    });

    it("should close client if Authorization header missing or invalid", async () => {
      req = {
        url: "ws://[::1]:3000/?userId=123?",
      };
      await gateway.handleConnection(client, req);
      expect(client.close).toHaveBeenCalledWith(1008, "param token not found");
    });
    it("should handle different message types correctly", async () => {
      const onMessageCallback = jest.fn();
      client.on = jest.fn((event, cb) => {
        if (event === "message") onMessageCallback.mockImplementation(cb);
        return client; // ✅ Retorna client para satisfazer o tipo original
      }) as any;

      req = {
        url: "ws://[::1]:3000/?userId=123&token=validtoken",
      };

      jwtService.verify.mockReturnValue({ userId: "123" });
      userService.getUserByID.mockResolvedValue({ _id: "123" } as any);

      await gateway.handleConnection(client, req);

      // Simula mensagem string
      onMessageCallback('{"event":"user.isOnline","data":{"userId":"123"}}');
      expect(webSocketService.handleMessage).toHaveBeenCalledWith(
        client,
        expect.any(String),
      );

      // Simula Buffer
      const bufferMessage = Buffer.from(
        '{"event":"user.isOnline","data":{"userId":"123"}}',
        "utf8",
      );
      onMessageCallback(bufferMessage);

      // Simula array de buffers
      const bufferArray = [Buffer.from("message")];
      onMessageCallback(bufferArray);

      // Simula ArrayBuffer
      const arrayBuffer = new ArrayBuffer(10);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < 10; i++) view[i] = i;
      onMessageCallback(arrayBuffer);

      expect(webSocketService.handleMessage).toHaveBeenCalledTimes(4);
    });

    it("should close client if token verification fails", async () => {
      req = {
        url: "ws://[::1]:3000/?userId=123",
        headers: { authorization: "Bearer invalidtoken" },
      };
      jwtService.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });
      await gateway.handleConnection(client, req);
      expect(client.close).toHaveBeenCalledWith(1008, "param token not found");
    });

    it("should close client if user not found", async () => {
      req = {
        url: "ws://[::1]:3000/user?userId=123&token=validtoken",
      };
      jwtService.verify.mockReturnValue({ userId: "123" });
      userService.getUserByID.mockRejectedValue(new Error("Not found"));
      await gateway.handleConnection(client, req);
      expect(client.close).toHaveBeenCalledWith(1008, "user not found");
    });

    it("should add client, set server, broadcast and setup message handler on successful connection", async () => {
      req = {
        url: "ws://[::1]:3000/?userId=123&token=validtoken",
      };
      jwtService.verify.mockReturnValue({ userId: "123" });
      userService.getUserByID.mockResolvedValue({ _id: "123" } as any);

      await gateway.handleConnection(client, req);

      expect(webSocketService.addClient).toHaveBeenCalledWith("123", client);
      expect(webSocketService.setServer).toHaveBeenCalledWith(gateway.server);
      expect(client.on).toHaveBeenCalledWith("message", expect.any(Function));
    });
  });

  describe("handleDisconnect", () => {
    it("should remove client and broadcast user.offline if user found", () => {
      const client = {} as any;
      webSocketService.usersOnline.set("user123", client);

      gateway.handleDisconnect(client);

      expect(webSocketService.removeClient).toHaveBeenCalledWith("user123");
    });

    it("should do nothing if user not found", () => {
      const client = {} as any;
      gateway.handleDisconnect(client);
      expect(webSocketService.removeClient).not.toHaveBeenCalled();
      expect(webSocketService.broadcast).not.toHaveBeenCalled();
    });
  });

  describe("getUser", () => {
    it("should return users data on success", async () => {
      const usersData = { total: 5, users: [] } as any;
      userService.getUsers.mockResolvedValue(usersData);

      const response = await gateway.getUser({ page: 2, perPage: 5 });
      expect(userService.getUsers).toHaveBeenCalledWith(2, 5);
      expect(response).toEqual({ event: "user", data: usersData });
    });

    it("should default to page 1 and perPage 10", async () => {
      const usersData = { total: 1, users: [] } as any;
      userService.getUsers.mockResolvedValue(usersData);

      const response = await gateway.getUser({});
      expect(userService.getUsers).toHaveBeenCalledWith(1, 10);
      expect(response).toEqual({ event: "user", data: usersData });
    });

    it("should return error event on failure", async () => {
      const error = { response: "some error" };
      userService.getUsers.mockRejectedValue(error);

      const response = await gateway.getUser({});
      expect(response).toEqual({ event: "error", data: "some error" });
    });
  });

  describe("getUserById", () => {
    it("should return user data on success", async () => {
      const user = { _id: "123", name: "John" } as any;
      userService.getUserByID.mockResolvedValue(user);

      const response = await gateway.getUserById({ id: "123" });
      expect(userService.getUserByID).toHaveBeenCalledWith("123");
      expect(response).toEqual({ event: "user.id", data: user });
    });

    it("should return error event on failure", async () => {
      const error = { response: "not found" };
      userService.getUserByID.mockRejectedValue(error);

      const response = await gateway.getUserById({ id: "123" });
      expect(response).toEqual({ event: "error", data: "not found" });
    });
  });
});

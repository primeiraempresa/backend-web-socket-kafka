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
        url: "/user",
        headers: { authorization: "Bearer token" },
      };
      await gateway.handleConnection(client, req);
      expect(client.close).toHaveBeenCalledWith(1008, "param userId not found");
    });

    it("should close client if Authorization header missing or invalid", async () => {
      req = {
        url: "/user?userId=123",
        headers: { authorization: "InvalidToken" },
      };
      await gateway.handleConnection(client, req);
      expect(client.close).toHaveBeenCalledWith(
        1008,
        "Missing or invalid authorization header",
      );
    });

    it("should close client if token verification fails", async () => {
      req = {
        url: "/user?userId=123",
        headers: { authorization: "Bearer invalidtoken" },
      };
      jwtService.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });
      await gateway.handleConnection(client, req);
      expect(client.close).toHaveBeenCalledWith(1008, "Unauthorized");
    });

    it("should close client if user not found", async () => {
      req = {
        url: "/user?userId=123",
        headers: { authorization: "Bearer validtoken" },
      };
      jwtService.verify.mockReturnValue({ userId: "123" });
      userService.getUserByID.mockRejectedValue(new Error("Not found"));
      await gateway.handleConnection(client, req);
      expect(client.close).toHaveBeenCalledWith(1008, "user not found");
    });

    it("should add client, set server, broadcast and setup message handler on successful connection", async () => {
      req = {
        url: "/user?userId=123",
        headers: { authorization: "Bearer validtoken" },
      };
      jwtService.verify.mockReturnValue({ userId: "123" });
      userService.getUserByID.mockResolvedValue({ _id: "123" } as any);

      await gateway.handleConnection(client, req);

      expect(webSocketService.addClient).toHaveBeenCalledWith("123", client);
      expect(webSocketService.setServer).toHaveBeenCalledWith(gateway.server);
      expect(webSocketService.broadcast).toHaveBeenCalledWith("user.online", {
        userId: "123",
        status: "online",
      });
      expect(client.on).toHaveBeenCalledWith("message", expect.any(Function));
    });
  });

  describe("handleDisconnect", () => {
    it("should remove client and broadcast user.offline if user found", () => {
      const client = {} as any;
      webSocketService.usersOnline.set("user123", client);

      gateway.handleDisconnect(client);

      expect(webSocketService.removeClient).toHaveBeenCalledWith("user123");
      expect(webSocketService.broadcast).toHaveBeenCalledWith("user.offline", {
        userId: "user123",
        status: "offline",
      });
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

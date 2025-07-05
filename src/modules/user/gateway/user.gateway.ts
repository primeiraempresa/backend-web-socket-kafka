import { WebSocketService } from "@common/services/webSocket.service";
import { configService } from "@config/configService";
import { JwtService } from "@nestjs/jwt";
import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { UserPagination } from "@user/models/userPagination.model";
import { UsersDocument } from "@user/schemas/user.schema";
import { UserService } from "@user/services/user.service";
import { RawData, Server, WebSocket } from "ws";

@WebSocketGateway({
  transports: ["websocket"],
  cors: { origin: "*" },
})
export class UserGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly webSocketService: WebSocketService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}
  async handleConnection(client: WebSocket, req: Request) {
    const baseUrl = configService.get<string>("URL");
    const url = new URL(req.url, baseUrl);
    const userId = url.searchParams.get("userId") as string;
    const token = url.searchParams.get("token") as string;
    if (!userId) {
      return client.close(1008, "param userId not found");
    }
    if (!token) {
      return client.close(1008, "param token not found");
    }
    try {
      const payload = this.jwtService.verify(token);
      if (!payload) {
        return client.close(1008, "Unauthorized");
      }
    } catch {
      return client.close(1008, "Unauthorized");
    }
    try {
      await this.userService.getUserByID(userId);
    } catch {
      return client.close(1008, "user not found");
    }

    this.webSocketService.addClient(userId, client);
    this.webSocketService.setServer(this.server);

    client.on("message", (message: RawData) => {
      if (typeof message === "string") {
        const text = message;
        this.webSocketService.handleMessage(client, text);
      }
      if (Buffer.isBuffer(message)) {
        const text = message.toString("utf8");
        this.webSocketService.handleMessage(client, text);
      }
      if (Array.isArray(message)) {
        const text = Buffer.concat(message).toString("utf8");
        this.webSocketService.handleMessage(client, text);
      }
      if (message instanceof ArrayBuffer) {
        const text = Buffer.from(message).toString("utf8");
        this.webSocketService.handleMessage(client, text);
      }
    });
  }

  handleDisconnect(client: WebSocket) {
    const userId = [...this.webSocketService.usersOnline.entries()].find(
      ([, socket]) => socket === client,
    )?.[0];

    if (userId) {
      this.webSocketService.removeClient(userId);
    }
  }
  @SubscribeMessage("user")
  async getUser(
    @MessageBody() body: { page?: number; perPage?: number },
  ): Promise<{
    event: string;
    data: UserPagination | Error;
  }> {
    try {
      const result: UserPagination = await this.userService.getUsers(
        body?.page ? parseInt(body?.page.toString()) : 1,
        body?.perPage ? parseInt(body?.perPage.toString()) : 10,
      );
      return {
        event: "user",
        data: result,
      };
    } catch (error) {
      return {
        event: "error",
        data: error?.response ?? error,
      };
    }
  }
  @SubscribeMessage("user.id")
  async getUserById(@MessageBody() body: { id: string }): Promise<{
    event: string;
    data: UsersDocument | Error;
  }> {
    try {
      const result: UsersDocument = await this.userService.getUserByID(body.id);
      return {
        event: "user.id",
        data: result,
      };
    } catch (error) {
      return {
        event: "error",
        data: error?.response ?? error,
      };
    }
  }
}

import { WebSocketService } from "@common/services/webSocket.service";
import { configService } from "@config/configService";
import { Inject } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { FilePagination } from "@upload/models/file_pagination.model";
import { FilesDocument } from "@upload/schemas/files.schema";
import { UploadProducerService } from "@upload/services/upload.producer.service";
import { UploadService } from "@upload/services/upload.service";
import { UserService } from "@user/services/user.service";
import { RawData, Server, WebSocket } from "ws";

@WebSocketGateway({
  path: "/upload",
  transports: ["websocket"],
  cors: { origin: "*" },
})
export class UploadGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  constructor(
    private readonly webSocketService: WebSocketService,
    private readonly userService: UserService,
    private readonly uploadService: UploadService,
    @Inject("UploadProducerService_create")
    private readonly uploadProducerService_create: UploadProducerService<{
      userId: string;
      file: Base64URLString;
      bucket: string;
    }>,
    @Inject("UploadProducerService_delete")
    private readonly UploadProducerService_delete: UploadProducerService<{
      userId: string;
      id: string;
    }>,
    private readonly jwtService: JwtService,
  ) {}
  async handleConnection(client: WebSocket, req: Request) {
    const baseUrl = configService.get<string>("URL") ?? "http://localhost:3000";
    const url = new URL(req.url, baseUrl);
    const authHeader = req.headers["authorization"];
    if (!authHeader?.startsWith("Bearer ")) {
      return client.close(1008, "Missing or invalid authorization header");
    }
    const token = authHeader.split(" ")[1];
    try {
      const payload = this.jwtService.verify(token);
      if (!payload) {
        return client.close(1008, "Unauthorized");
      }
    } catch {
      return client.close(1008, "Unauthorized");
    }

    const userId = url.searchParams.get("userId") as string;
    if (!userId) {
      return client.close(1008, "param userId not found");
    }
    try {
      await this.userService.getUserByID(userId);
    } catch {
      return client.close(1008, "user not found");
    }

    this.webSocketService.addClient(userId, client);
    this.webSocketService.setServer(this.server);

    this.webSocketService.broadcast("user.online", {
      userId,
      status: "online",
    });

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

      this.webSocketService.broadcast("user.offline", {
        userId,
        status: "offline",
      });
    }
  }
  @SubscribeMessage("upload")
  async getUpload(
    @MessageBody() body: { page?: number; perPage?: number },
  ): Promise<{
    event: string;
    data: FilePagination | Error;
  }> {
    try {
      const result: FilePagination = await this.uploadService.getFileAll(
        body?.page ? parseInt(body?.page.toString()) : 1,
        body?.perPage ? parseInt(body?.perPage.toString()) : 10,
      );
      return {
        event: "upload",
        data: result,
      };
    } catch (error) {
      return {
        event: "error",
        data: error?.response ?? error,
      };
    }
  }
  @SubscribeMessage("upload.id")
  async getUploadById(@MessageBody() body: { id: string }): Promise<{
    event: string;
    data: FilesDocument | Error;
  }> {
    try {
      const result: FilesDocument = await this.uploadService.getFileByID(
        body.id,
      );
      return {
        event: "upload.id",
        data: result,
      };
    } catch (error) {
      return {
        event: "error",
        data: error?.response ?? error,
      };
    }
  }
  @SubscribeMessage("upload.search")
  async searchUpload(
    @MessageBody()
    body: {
      bucket?: string;
      fieldname?: string;
      originalname?: string;
      key?: string;
      location?: string;
      contentType?: string;
      mimetype?: string;
    },
  ): Promise<{ event: string; data: FilesDocument[] | Error }> {
    try {
      const result: FilesDocument[] = await this.uploadService.searchFile(
        body?.bucket,
        body?.fieldname,
        body?.originalname,
        body?.key,
        body?.location,
        body?.contentType,
        body?.mimetype,
      );
      return {
        event: "upload.id",
        data: result,
      };
    } catch (error) {
      return {
        event: "error",
        data: error?.response ?? error,
      };
    }
  }
  @SubscribeMessage("upload.create")
  createUpload(
    @MessageBody() body: { file: Base64URLString; bucket: string },
    @ConnectedSocket() client: WebSocket,
  ) {
    try {
      const userId = this.webSocketService.getUserIdBySocket(client) as string;
      return this.uploadProducerService_create.sendMessage("upload.create", {
        userId,
        ...body,
      });
    } catch (error) {
      return {
        event: "error",
        data: error?.response ?? error,
      };
    }
  }
  @SubscribeMessage("upload.delete")
  deleteUpload(
    @MessageBody()
    body: {
      id: string;
    },
    @ConnectedSocket() client: WebSocket,
  ) {
    try {
      const userId = this.webSocketService.getUserIdBySocket(client) as string;
      return this.UploadProducerService_delete.sendMessage("upload.delete", {
        userId,
        id: body.id,
      });
    } catch (error) {
      return {
        event: "error",
        data: error?.response ?? error,
      };
    }
  }
}

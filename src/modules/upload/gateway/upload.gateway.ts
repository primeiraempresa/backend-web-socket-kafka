import { CommonService } from "@common/services/common.service";
import { WebSocketService } from "@common/services/webSocket.service";
import { configService } from "@config/configService";
import { Inject } from "@nestjs/common";
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
import { Server, WebSocket } from "ws";

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
    private readonly commonService: CommonService,
    @Inject("UploadProducerService_create")
    private readonly uploadProducerService: UploadProducerService<{
      userId: string;
      file: Base64URLString;
      bucket: string;
    }>,
  ) {}
  async handleConnection(client: WebSocket, req: Request) {
    const baseUrl = configService.get<string>("URL") || "http://localhost:3000";
    const url = new URL(req.url, baseUrl);
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

    client.on("message", (message) => {
      this.webSocketService.handleMessage(client, message.toString());
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
        data: error?.response || error,
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
        data: error?.response || error,
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
        data: error?.response || error,
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
      return this.uploadProducerService.sendMessage("upload.create", {
        userId,
        ...body,
      });
    } catch (error) {
      return {
        event: "error",
        data: error?.response || error,
      };
    }
  }
}

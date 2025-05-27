import { Injectable, Logger } from "@nestjs/common";
import { Server, WebSocket } from "ws";

@Injectable()
export class ChatWebSocketService {
  private readonly logger = new Logger(ChatWebSocketService.name);

  server: Server;
  usersOnline = new Map<string, WebSocket>();

  setServer(server: Server) {
    this.server = server;
  }

  addClient(userId: string, client: WebSocket) {
    this.usersOnline.set(userId, client);
    this.logger.debug(`User ${userId} connected`);
  }

  removeClient(userId: string) {
    this.usersOnline.delete(userId);
    this.logger.debug(`User ${userId} disconnected`);
  }

  sendToUser(userId: string, event: string, data: any) {
    const client = this.usersOnline.get(userId);
    if (client && client.readyState === client.OPEN) {
      client.send(JSON.stringify({ event, data }));
    }
  }

  broadcast(event: string, data: any) {
    const message = JSON.stringify({ event, data });
    this.usersOnline.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    });
  }
}

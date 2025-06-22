import { Injectable, Logger } from "@nestjs/common";
import { Server, WebSocket } from "ws";

@Injectable()
export class WebSocketService {
  private readonly logger = new Logger(WebSocketService.name);

  server: Server;
  usersOnline: Map<string, WebSocket> = new Map<string, WebSocket>();

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

  sendToUser(userId: string, event: string, data: object) {
    const client = this.usersOnline.get(userId);
    if (client && client.readyState === client.OPEN) {
      client.send(JSON.stringify({ event, data }));
    }
  }

  broadcast(event: string, data: object) {
    const message = JSON.stringify({ event, data });
    this.usersOnline.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    });
  }
  getUserIdByID_online(userId: string): boolean {
    const user = this.usersOnline.get(userId);
    if (user) {
      return true;
    }
    return false;
  }
  getUserIdBySocket(client: WebSocket): string | undefined {
    return [...this.usersOnline.entries()].find(
      ([, socket]) => socket === client,
    )?.[0];
  }
  handleMessage(client: WebSocket, rawMessage: string) {
    try {
      const { event, data } = JSON.parse(rawMessage);
      const { userId } = data;
      const isOnline: boolean = this.usersOnline.has(userId);

      switch (event) {
        case "users.online":
          client.send(
            JSON.stringify({
              event: "users.online",
              data: {
                users: Array.from(this.usersOnline.keys()),
              },
            }),
          );
          break;
        case "user.isOnline":
          client.send(
            JSON.stringify({
              event: "user.isOnline",
              data: { userId, isOnline },
            }),
          );
          break;
      }
    } catch {
      client.send(
        JSON.stringify({
          event: "error",
          data: "Invalid message format",
        }),
      );
    }
  }
}

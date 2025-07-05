import axios from "axios";
import { RawData, WebSocket } from "ws";
import { Logger } from "@nestjs/common";
import * as env from "dotenv";
env.config();
class LoadTestLogger {
  private static readonly logger = new Logger("LoadTest");

  static app(message: string) {
    this.logger.log(`🟢 [APP] ${message}`);
  }

  static user(userId: string, username: string, message: string) {
    this.logger.log(`👤 [User: ${username} | ID: ${userId}] ${message}`);
  }

  static websocket(userId: string, username: string, message: string) {
    this.logger.log(`🔗 [WS | ${username}] ${message}`);
  }

  static error(userId: string, username: string, message: string, error: any) {
    this.logger.error(
      `❌ [User: ${username} | ID: ${userId}] ${message}`,
      error,
    );
  }
}

const WS_BASE = "ws://localhost:3000/";
const API_BASE = "http://localhost:3000/api";

const CLIENT_ID = process.env.client_id;
const CLIENT_SECRET = process.env.client_secret;

interface User {
  id: string;
  token: string;
  username: string;
  ws: WebSocket;
}

let appAccessToken: string;

async function loginApp() {
  const res = await axios.post(`${API_BASE}/auth`, {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "client_credentials",
  });
  appAccessToken = res.data.access_token;
}

async function createUser(index: number): Promise<User> {
  const userData = {
    username: `user${index}`,
    email: `user${index}@test.com`,
    password: "Test@123",
    esportes: {},
    profilePic: "",
  };

  const res = await axios.post(`${API_BASE}/user`, userData, {
    headers: { Authorization: `Bearer ${appAccessToken}` },
  });

  const loginRes = await axios.post(
    `${API_BASE}/user/login`,
    { user: userData.username, password: userData.password },
    { headers: { Authorization: `Bearer ${appAccessToken}` } },
  );

  const token = loginRes.data.accessToken;
  const ws = new WebSocket(
    `${WS_BASE}?userId=${res.data._id}&token=${appAccessToken}`,
  );

  await new Promise<void>((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });

  LoadTestLogger.user(
    res.data._id,
    userData.username,
    "User created, logged in and WebSocket connected",
  );

  return { id: res.data._id, token, username: userData.username, ws };
}

function sendWsAndWaitResponse(
  user: User,
  event: string,
  data: any,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      user.ws.off("message", handleMessage);
      reject(new Error(`Timeout waiting for response to event: ${event}`));
    }, 8000);

    const handleMessage = (raw: RawData) => {
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed.event === event) {
          clearTimeout(timeout);
          user.ws.off("message", handleMessage);
          LoadTestLogger.websocket(
            user.id,
            user.username,
            `Received response for ${event}: ${JSON.stringify(parsed.data)}`,
          );
          resolve(parsed.data);
        }
      } catch {
        // Ignore invalid messages
      }
    };

    user.ws.on("message", handleMessage);

    const payload = JSON.stringify({ event, data });
    user.ws.send(payload);
    LoadTestLogger.websocket(
      user.id,
      user.username,
      `Sent event: ${event} with data: ${JSON.stringify(data)}`,
    );
  });
}

async function createChat(user: User, userIds: string[]): Promise<string> {
  const response = await sendWsAndWaitResponse(user, "chat.create", {
    chatters: userIds,
  });
  return response._id;
}

async function sendMessage(user: User, chatId: string, content: string) {
  await sendWsAndWaitResponse(user, "chat.message.create", {
    chatId,
    chat_conversation: {
      message: content,
      sender: user.id,
    },
  });
}

async function main() {
  const userCount = 1000;
  const users: User[] = [];

  LoadTestLogger.app(
    "Starting WebSocket Load Test (same-event-response pattern)...",
  );

  await loginApp();

  for (let i = 0; i < userCount; i++) {
    const user = await createUser(i);
    users.push(user);
  }

  for (let i = 0; i < users.length; i += 2) {
    if (i + 1 >= users.length) break;

    const userA = users[i];
    const userB = users[i + 1];
    const userIds = [userA.id, userB.id];

    try {
      const chatId = await createChat(userA, userIds);

      Promise.all([
        sendMessage(userA, chatId, `Hello from ${userA.username}`),
        sendMessage(userB, chatId, `Hello from ${userB.username}`),
      ]);
    } catch (err) {
      LoadTestLogger.app(
        `❌ Error with chat between ${userA.username} & ${userB.username}: ${err}`,
      );
    }
  }

  LoadTestLogger.app("✅ Load test completed!");
  process.exit(0);
}

main().catch((err) => console.error("❌ Load test failed:", err));

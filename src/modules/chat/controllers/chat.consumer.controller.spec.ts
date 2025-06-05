import { Test, TestingModule } from "@nestjs/testing";
import { ChatConsumerController } from "./chat.consumer.controller";
import { ChatService } from "@chat/services/chat.service";
import { WebSocketService } from "@common/services/webSocket.service";

describe("ChatConsumerController", () => {
  let controller: ChatConsumerController;
  let chatService: jest.Mocked<ChatService>;
  let chatWebSocketService: jest.Mocked<WebSocketService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatConsumerController],
      providers: [
        {
          provide: ChatService,
          useValue: {
            createChat: jest.fn(),
            deleteChatById: jest.fn(),
            addMessage: jest.fn(),
            updateMessageById: jest.fn(),
            deleteMessageById: jest.fn(),
          },
        },
        {
          provide: WebSocketService,
          useValue: {
            sendToUser: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ChatConsumerController>(ChatConsumerController);
    chatService = module.get(ChatService);
    chatWebSocketService = module.get(WebSocketService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("handleChatCreate", () => {
    it("should create a chat and send to websocket", async () => {
      const message = {
        userId: "user1",
        chats: { chatters: ["user1", "user2"] },
      };
      const result = { _id: "chat1" } as any;
      chatService.createChat.mockResolvedValue(result);

      const response = await controller.handleChatCreate(message);

      expect(chatService.createChat).toHaveBeenCalledWith(["user1", "user2"]);
      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "chat.create",
        result,
      );
      expect(response).toEqual(result);
    });
  });

  describe("handleChatDelete", () => {
    it("should delete a chat and send to websocket", async () => {
      const message = { userId: "user1", chatId: "chat1" };
      const result = { _id: "chat1" } as any;
      chatService.deleteChatById.mockResolvedValue(result);

      const response = await controller.handleChatDelete(message);

      expect(chatService.deleteChatById).toHaveBeenCalledWith("chat1");
      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "chat.delete",
        result,
      );
      expect(response).toEqual(result);
    });
  });

  describe("handleMessageCreate", () => {
    it("should create a message and send to websocket", async () => {
      const message = {
        userId: "user1",
        chatId: "chat1",
        chat_conversation: { text: "Hello" } as any,
      };
      const result = { _id: "msg1" } as any;
      chatService.addMessage.mockResolvedValue(result);

      const response = await controller.handleMessageCreate(message);

      expect(chatService.addMessage).toHaveBeenCalledWith("chat1", {
        text: "Hello",
      });
      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "chat.message.create",
        result,
      );
      expect(response).toEqual(result);
    });
  });

  describe("handleMessageUpdate", () => {
    it("should update a message and send to websocket", async () => {
      const message = {
        userId: "user1",
        chatId: "chat1",
        messageId: "msg1",
        chat_conversation: { text: "Updated" } as any,
      };
      const result = { _id: "msg1", text: "Updated" } as any;
      chatService.updateMessageById.mockResolvedValue(result);

      const response = await controller.handleMessageUpdate(message);

      expect(chatService.updateMessageById).toHaveBeenCalledWith(
        "chat1",
        "msg1",
        { text: "Updated" },
      );
      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "chat.message.update",
        result,
      );
      expect(response).toEqual(result);
    });
  });

  describe("handleMessageDelete", () => {
    it("should delete a message and send to websocket", async () => {
      const message = { userId: "user1", chatId: "chat1", messageId: "msg1" };
      const result = { _id: "msg1" } as any;
      chatService.deleteMessageById.mockResolvedValue(result);

      const response = await controller.handleMessageDelete(message);

      expect(chatService.deleteMessageById).toHaveBeenCalledWith(
        "chat1",
        "msg1",
      );
      expect(chatWebSocketService.sendToUser).toHaveBeenCalledWith(
        "user1",
        "chat.message.delete",
        result,
      );
      expect(response).toEqual(result);
    });
  });
});

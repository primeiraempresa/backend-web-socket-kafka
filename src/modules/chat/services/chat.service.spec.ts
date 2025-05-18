import { Test, TestingModule } from "@nestjs/testing";
import { ChatService } from "./chat.service";
import { getConnectionToken, getModelToken } from "@nestjs/mongoose";
import { CommonService } from "@common/services/common.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";

describe("ChatService", () => {
  let service: ChatService;
  let chatModel: any;
  let connection: any;
  let commonService: any;
  let messageModel: any;

  beforeEach(async () => {
    chatModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };

    messageModel = {
      create: jest.fn(),
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn(),
      countDocuments: jest.fn(),
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn().mockReturnThis(),
      findByIdAndDelete: jest.fn().mockReturnThis(),
    };

    connection = {
      createCollection: jest.fn(),
      dropCollection: jest.fn(),
      model: jest.fn().mockReturnValue(messageModel),
    };

    commonService = {
      validateMongoID: jest.fn().mockReturnValue(true),
      validateArryByMongoIDs: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getModelToken("Chats"), useValue: chatModel },
        { provide: getConnectionToken(), useValue: connection },
        { provide: CommonService, useValue: commonService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  afterEach(() => jest.clearAllMocks());

  it("createChat - should create chat and collection", async () => {
    const mockChat = { _id: "chat123", chatters: ["u1", "u2"] };
    chatModel.create.mockResolvedValue(mockChat);

    const result = await service.createChat(["u1", "u2"]);
    expect(result).toEqual(mockChat);
    expect(chatModel.create).toHaveBeenCalled();
    expect(connection.createCollection).toHaveBeenCalledWith(
      "ChatMessage_chat123",
    );
  });

  it("addMessage - should add a message", async () => {
    const message = { sender: "u1", message: "hello" };
    messageModel.create.mockResolvedValue(message);

    const result = await service.addMessage("chat1", "u1", "hello");
    expect(result).toEqual(message);
    expect(messageModel.create).toHaveBeenCalledWith({
      sender: "u1",
      message: "hello",
    });
  });

  it("getMessages - should return paginated messages", async () => {
    const messages = [{ sender: "u1", message: "hi" }];
    messageModel.exec.mockResolvedValue(messages);
    messageModel.countDocuments.mockResolvedValue(1);

    const result = await service.getMessages("chat1", 1, 10);
    expect(result.items).toEqual(messages);
    expect(result.totalItems).toEqual(1);
  });

  it("getMessages - should throw NotFoundException if no messages", async () => {
    messageModel.exec.mockResolvedValue([]);
    messageModel.countDocuments.mockResolvedValue(0);

    await expect(service.getMessages("chat1", 1, 10)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("getChatByUsersIds - should return chat by ID", async () => {
    const chat = { _id: "chat1", chatters: [] };
    const populate = jest.fn().mockResolvedValue(chat);
    chatModel.findOne.mockReturnValue({ populate });

    const result = await service.getChatByUsersIds(undefined, "chat1");
    expect(result).toEqual(chat);
  });

  it("getChatByUsersIds - should throw BadRequest for invalid ID", async () => {
    commonService.validateMongoID.mockReturnValue(false);
    await expect(service.getChatByUsersIds(undefined, "badid")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("getMessageById - should return a message", async () => {
    const message = { _id: "msg1", message: "hello" };
    messageModel.populate.mockResolvedValue(message);
    messageModel.findOne.mockReturnValue(messageModel);

    const result = await service.getMessageById("chat1", "msg1");
    expect(result).toEqual(message);
  });

  it("updateMessageById - should update message", async () => {
    const updated = { _id: "msg1", message: "edited" };
    messageModel.exec.mockResolvedValue(updated);

    const result = await service.updateMessageById("chat1", "msg1", {
      message: "edited",
    });
    expect(result).toEqual(updated);
  });

  it("deleteMessageById - should delete a message", async () => {
    const deleted = { _id: "msg1" };
    messageModel.exec.mockResolvedValue(deleted);

    const result = await service.deleteMessageById("chat1", "msg1");
    expect(result).toEqual(deleted);
  });

  it("deleteChatById - should delete chat and drop collection", async () => {
    const chat = { _id: "chat123" };
    chatModel.findByIdAndDelete.mockResolvedValue(chat);

    const result = await service.deleteChatById("chat123");
    expect(result).toEqual(chat);
    expect(connection.dropCollection).toHaveBeenCalledWith(
      "ChatMessage_chat123",
    );
  });
});

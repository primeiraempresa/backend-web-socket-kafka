import { Test, TestingModule } from "@nestjs/testing";
import { UploadGateway } from "./upload.gateway";
import { WebSocketService } from "@common/services/webSocket.service";
import { JwtService } from "@nestjs/jwt";
import { Server, WebSocket } from "ws";
import { UserService } from "@user/services/user.service";
import { UploadService } from "@upload/services/upload.service";
import { getModelToken } from "@nestjs/mongoose";
import { Users } from "@user/models/user.model";
import { CacheService } from "@common/services/cache.service";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
jest.mock("@upload/services/upload.service", () => {
  return {
    UploadService: jest.fn().mockImplementation(() => ({
      getFileAll: jest.fn(),
      getFileByID: jest.fn(),
      searchFile: jest.fn(),
    })),
  };
});

jest.mock("file-type", () => {
  return {
    fileTypeFromBuffer: jest
      .fn()
      .mockResolvedValue({ mime: "image/png", ext: "png" }),
  };
});
describe("UploadGateway", () => {
  let gateway: UploadGateway;
  let mockCacheManager: jest.Mocked<Cache>;

  // Mocks
  const mockWebSocketService = {
    addClient: jest.fn(),
    removeClient: jest.fn(),
    broadcast: jest.fn(),
    setServer: jest.fn(),
    handleMessage: jest.fn(),
    getUserIdBySocket: jest.fn(),
    usersOnline: new Map(),
  };

  const mockUserService = {
    getUserByID: jest.fn(),
  };

  const mockUploadService = {
    getFileAll: jest.fn(),
    getFileByID: jest.fn(),
    searchFile: jest.fn(),
  };
  const mockJwtService = {
    verify: jest.fn(),
  };

  const mockUploadProducerCreate = {
    sendMessage: jest.fn(),
  };

  const mockUploadProducerDelete = {
    sendMessage: jest.fn(),
  };
  const mockUsersModel = () => ({
    find: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn().mockReturnThis(),
    findByIdAndUpdate: jest.fn().mockReturnThis(),
    findOneAndDelete: jest.fn(),
    findOne: jest.fn().mockReturnThis(),
    create: jest.fn(),
  });
  beforeEach(async () => {
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      // outros métodos que o Cache pode ter
    } as unknown as jest.Mocked<Cache>;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadGateway,
        { provide: WebSocketService, useValue: mockWebSocketService },
        { provide: UploadService, useValue: mockUploadService },
        { provide: JwtService, useValue: mockJwtService },
        UserService,
        { provide: getModelToken(Users.name), useFactory: mockUsersModel },
        {
          provide: "CACHE_MANAGER",
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
        {
          provide: "UploadProducerService_delete",
          useValue: mockUploadProducerDelete,
        },
        {
          provide: "UploadProducerService_create",
          useValue: mockUploadProducerCreate,
        },
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    gateway = module.get<UploadGateway>(UploadGateway);
    gateway.server = {} as Server;

    // Clear mocks before each test
    jest.clearAllMocks();
  });

  describe("handleConnection", () => {
    it("should close connection if no auth header", async () => {
      const client = { close: jest.fn(), on: jest.fn() } as any;
      const req: any = { headers: {}, url: "/upload?userId=test" };

      await gateway.handleConnection(client, req);
      expect(client.close).toHaveBeenCalledWith(
        1008,
        "Missing or invalid authorization header",
      );
    });

    it("should close connection if token is invalid", async () => {
      const client = { close: jest.fn(), on: jest.fn() } as any;
      const req: any = {
        headers: { authorization: "Bearer invalid" },
        url: "/upload?userId=test",
      };

      mockJwtService.verify.mockImplementation(() => {
        throw new Error("Invalid");
      });

      await gateway.handleConnection(client, req);
      expect(client.close).toHaveBeenCalledWith(1008, "Unauthorized");
    });

    it("should close connection if user is not found", async () => {
      const client = { close: jest.fn(), on: jest.fn() } as any;
      const req: any = {
        headers: { authorization: "Bearer token" },
        url: "/upload?userId=test",
      };

      mockJwtService.verify.mockReturnValue({ userId: "test" });
      mockUserService.getUserByID.mockRejectedValue(new Error("not found"));

      await gateway.handleConnection(client, req);
      expect(client.close).toHaveBeenCalledWith(1008, "user not found");
    });
  });

  describe("handleDisconnect", () => {
    it("should broadcast user.offline if user is online", () => {
      const client = {} as WebSocket;
      mockWebSocketService.usersOnline.set("user123", client);

      gateway.handleDisconnect(client);

      expect(mockWebSocketService.removeClient).toHaveBeenCalledWith("user123");
      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith(
        "user.offline",
        {
          userId: "user123",
          status: "offline",
        },
      );
    });

    it("should do nothing if user is not found", () => {
      const client = {} as WebSocket;
      gateway.handleDisconnect(client);
      expect(mockWebSocketService.removeClient).not.toHaveBeenCalled();
    });
  });

  describe("getUpload", () => {
    it("should return file pagination", async () => {
      const mockResult = { files: [], total: 0 };
      mockUploadService.getFileAll.mockResolvedValue(mockResult);

      const res = await gateway.getUpload({ page: 1, perPage: 10 });
      expect(res).toEqual({ event: "upload", data: mockResult });
    });

    it("should return error if service throws", async () => {
      mockUploadService.getFileAll.mockRejectedValue({ response: "Error" });

      const res = await gateway.getUpload({ page: 1, perPage: 10 });
      expect(res).toEqual({ event: "error", data: "Error" });
    });
  });

  describe("getUploadById", () => {
    it("should return file by ID", async () => {
      const file = { _id: "abc123" };
      mockUploadService.getFileByID.mockResolvedValue(file as any);

      const res = await gateway.getUploadById({ id: "abc123" });
      expect(res).toEqual({ event: "upload.id", data: file });
    });

    it("should return error on exception", async () => {
      mockUploadService.getFileByID.mockRejectedValue({
        response: "Not found",
      });

      const res = await gateway.getUploadById({ id: "abc123" });
      expect(res).toEqual({ event: "error", data: "Not found" });
    });
  });

  describe("searchUpload", () => {
    it("should return array of files", async () => {
      const files = [{ _id: "1" }, { _id: "2" }];
      mockUploadService.searchFile.mockResolvedValue(files as any);

      const res = await gateway.searchUpload({});
      expect(res).toEqual({ event: "upload.id", data: files });
    });

    it("should return error on exception", async () => {
      mockUploadService.searchFile.mockRejectedValue({
        response: "Search error",
      });

      const res = await gateway.searchUpload({});
      expect(res).toEqual({ event: "error", data: "Search error" });
    });
  });

  describe("createUpload", () => {
    it("should send upload.create message", () => {
      const client = {} as WebSocket;
      mockWebSocketService.getUserIdBySocket.mockReturnValue("user123");

      const body = { file: "filedata", bucket: "bucket-name" };

      gateway.createUpload(body, client);

      expect(mockUploadProducerCreate.sendMessage).toHaveBeenCalledWith(
        "upload.create",
        {
          userId: "user123",
          file: "filedata",
          bucket: "bucket-name",
        },
      );
    });
  });

  describe("deleteUpload", () => {
    it("should send upload.delete message", () => {
      const client = {} as WebSocket;
      mockWebSocketService.getUserIdBySocket.mockReturnValue("user123");

      const body = { id: "fileId" };

      gateway.deleteUpload(body, client);

      expect(mockUploadProducerDelete.sendMessage).toHaveBeenCalledWith(
        "upload.delete",
        {
          userId: "user123",
          id: "fileId",
        },
      );
    });
  });
});

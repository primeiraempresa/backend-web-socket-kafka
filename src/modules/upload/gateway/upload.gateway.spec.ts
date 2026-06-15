/* eslint-disable @typescript-eslint/only-throw-error */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { configService } from "@config/config.service";
import { UploadGateway } from "./upload.gateway";
import { WebSocketService } from "@common/services/webSocket.service";
import { UserService } from "@user/services/user.service";
import { UploadService } from "@upload/services/upload.service";
import { UploadProducerService } from "@upload/services/upload.producer.service";

jest.mock("@config/config.service", () => ({
  configService: {
    get: jest.fn(),
  },
}));

describe("UploadGateway", () => {
  let gateway: UploadGateway;

  const webSocketServiceMock = {
    addClient: jest.fn(),
    setServer: jest.fn(),
    handleMessage: jest.fn(),
    removeClient: jest.fn(),
    getUserIdBySocket: jest.fn(),
    usersOnline: new Map<string, any>(),
  };

  const userServiceMock = {
    getUserByID: jest.fn(),
  };

  const uploadServiceMock = {
    getFileAll: jest.fn(),
    getFileByID: jest.fn(),
    searchFile: jest.fn(),
  };

  const uploadProducerServiceMock = {
    sendMessage: jest.fn(),
  };

  const jwtServiceMock = {
    verify: jest.fn(),
  };

  const makeClient = () => {
    const handlers: Record<string, (...args: any[]) => void> = {};
    const client = {
      close: jest.fn(),
      on: jest.fn((event: string, cb: (...args: any[]) => void) => {
        handlers[event] = cb;
        return client;
      }),
    };
    return { client: client as any, handlers };
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    webSocketServiceMock.usersOnline.clear();

    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === "URL") return "ws://localhost:3000";
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadGateway,
        { provide: WebSocketService, useValue: webSocketServiceMock },
        { provide: UserService, useValue: userServiceMock },
        { provide: UploadService, useValue: uploadServiceMock },
        { provide: UploadProducerService, useValue: uploadProducerServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
      ],
    }).compile();

    gateway = module.get<UploadGateway>(UploadGateway);
    gateway.server = {} as any;
  });

  describe("handleConnection", () => {
    it("deve fechar quando userId não existir", async () => {
      const { client } = makeClient();
      const req = { url: "/?token=abc" } as Request;

      await gateway.handleConnection(client, req);

      expect(client.close).toHaveBeenCalledWith(1008, "param userId not found");
      expect(jwtServiceMock.verify).not.toHaveBeenCalled();
      expect(userServiceMock.getUserByID).not.toHaveBeenCalled();
    });

    it("deve fechar quando token não existir", async () => {
      const { client } = makeClient();
      const req = { url: "/?userId=123" } as Request;

      await gateway.handleConnection(client, req);

      expect(client.close).toHaveBeenCalledWith(1008, "param token not found");
      expect(jwtServiceMock.verify).not.toHaveBeenCalled();
      expect(userServiceMock.getUserByID).not.toHaveBeenCalled();
    });

    it("deve fechar quando jwt.verify retornar payload inválido", async () => {
      const { client } = makeClient();
      const req = { url: "/?userId=123&token=abc" } as Request;

      jwtServiceMock.verify.mockReturnValue(null);

      await gateway.handleConnection(client, req);

      expect(jwtServiceMock.verify).toHaveBeenCalledWith("abc");
      expect(client.close).toHaveBeenCalledWith(1008, "Unauthorized");
      expect(userServiceMock.getUserByID).not.toHaveBeenCalled();
    });

    it("deve fechar quando jwt.verify lançar erro", async () => {
      const { client } = makeClient();
      const req = { url: "/?userId=123&token=abc" } as Request;

      jwtServiceMock.verify.mockImplementation(() => {
        throw new Error("invalid token");
      });

      await gateway.handleConnection(client, req);

      expect(jwtServiceMock.verify).toHaveBeenCalledWith("abc");
      expect(client.close).toHaveBeenCalledWith(1008, "Unauthorized");
      expect(userServiceMock.getUserByID).not.toHaveBeenCalled();
    });

    it("deve fechar quando usuário não existir", async () => {
      const { client } = makeClient();
      const req = { url: "/?userId=123&token=abc" } as Request;

      jwtServiceMock.verify.mockReturnValue({ sub: "123" });
      userServiceMock.getUserByID.mockRejectedValue(new Error("not found"));

      await gateway.handleConnection(client, req);

      expect(jwtServiceMock.verify).toHaveBeenCalledWith("abc");
      expect(userServiceMock.getUserByID).toHaveBeenCalledWith("123");
      expect(client.close).toHaveBeenCalledWith(1008, "user not found");
      expect(webSocketServiceMock.addClient).not.toHaveBeenCalled();
    });

    it("deve adicionar cliente, setar server e processar mensagens em string, Buffer, Array e ArrayBuffer", async () => {
      const { client, handlers } = makeClient();
      const req = { url: "/?userId=123&token=abc" } as Request;

      jwtServiceMock.verify.mockReturnValue({ sub: "123" });
      userServiceMock.getUserByID.mockResolvedValue({ id: "123" });

      await gateway.handleConnection(client, req);

      expect(webSocketServiceMock.addClient).toHaveBeenCalledWith(
        "123",
        client,
      );
      expect(webSocketServiceMock.setServer).toHaveBeenCalledWith(
        gateway.server,
      );
      expect(client.on).toHaveBeenCalledWith("message", expect.any(Function));

      handlers.message("hello");
      handlers.message(Buffer.from("buffer"));
      handlers.message([Buffer.from("a"), Buffer.from("b")]);
      const arrayBuffer = Buffer.from("arraybuffer").buffer;
      handlers.message(arrayBuffer as ArrayBuffer);

      expect(webSocketServiceMock.handleMessage).toHaveBeenNthCalledWith(
        1,
        client,
        "hello",
      );
      expect(webSocketServiceMock.handleMessage).toHaveBeenNthCalledWith(
        2,
        client,
        "buffer",
      );
      expect(webSocketServiceMock.handleMessage).toHaveBeenNthCalledWith(
        3,
        client,
        "ab",
      );
      expect(webSocketServiceMock.handleMessage).toHaveBeenNthCalledWith(
        4,
        client,
        Buffer.from(arrayBuffer).toString("utf8"),
      );
    });
  });

  describe("handleDisconnect", () => {
    it("deve remover cliente quando socket estiver mapeado", () => {
      const client = {} as any;
      webSocketServiceMock.usersOnline.set("user-1", client);

      gateway.handleDisconnect(client);

      expect(webSocketServiceMock.removeClient).toHaveBeenCalledWith("user-1");
    });

    it("não deve fazer nada quando socket não estiver mapeado", () => {
      gateway.handleDisconnect({} as any);

      expect(webSocketServiceMock.removeClient).not.toHaveBeenCalled();
    });
  });

  describe("getUpload", () => {
    it("deve buscar paginação com defaults", async () => {
      const result = { items: [], total: 0, page: 1, perPage: 10 } as any;
      uploadServiceMock.getFileAll.mockResolvedValue(result);

      const response = await gateway.getUpload({});

      expect(uploadServiceMock.getFileAll).toHaveBeenCalledWith(1, 10);
      expect(response).toEqual({ event: "upload", data: result });
    });

    it("deve buscar paginação com page e perPage informados", async () => {
      const result = { items: [], total: 1, page: 2, perPage: 5 } as any;
      uploadServiceMock.getFileAll.mockResolvedValue(result);

      const response = await gateway.getUpload({ page: 2, perPage: 5 });

      expect(uploadServiceMock.getFileAll).toHaveBeenCalledWith(2, 5);
      expect(response).toEqual({ event: "upload", data: result });
    });

    it("deve retornar error.response quando houver erro com response", async () => {
      uploadServiceMock.getFileAll.mockRejectedValue({
        response: { message: "bad request" },
      });

      const response = await gateway.getUpload({});

      expect(response).toEqual({
        event: "error",
        data: { message: "bad request" },
      });
    });

    it("deve retornar o próprio erro quando não houver response", async () => {
      uploadServiceMock.getFileAll.mockRejectedValue(new Error("boom"));

      const response = await gateway.getUpload({});

      expect(response).toEqual({ event: "error", data: expect.any(Error) });
    });
  });

  describe("getUploadById", () => {
    it("deve buscar upload por id", async () => {
      const file = { id: "file-1" } as any;
      uploadServiceMock.getFileByID.mockResolvedValue(file);

      const response = await gateway.getUploadById({ id: "file-1" });

      expect(uploadServiceMock.getFileByID).toHaveBeenCalledWith("file-1");
      expect(response).toEqual({ event: "upload.id", data: file });
    });

    it("deve retornar error.response quando houver erro com response", async () => {
      uploadServiceMock.getFileByID.mockRejectedValue({
        response: { message: "not found" },
      });

      const response = await gateway.getUploadById({ id: "x" });

      expect(response).toEqual({
        event: "error",
        data: { message: "not found" },
      });
    });

    it("deve retornar o próprio erro quando não houver response", async () => {
      uploadServiceMock.getFileByID.mockRejectedValue(new Error("boom"));

      const response = await gateway.getUploadById({ id: "x" });

      expect(response).toEqual({ event: "error", data: expect.any(Error) });
    });
  });

  describe("searchUpload", () => {
    it("deve buscar uploads por filtros", async () => {
      const files = [{ id: "1" }, { id: "2" }] as any;
      uploadServiceMock.searchFile.mockResolvedValue(files);

      const response = await gateway.searchUpload({
        bucket: "bucket",
        fieldname: "field",
        originalname: "orig",
        key: "key",
        location: "location",
        contentType: "content",
        mimetype: "mime",
      });

      expect(uploadServiceMock.searchFile).toHaveBeenCalledWith(
        "bucket",
        "field",
        "orig",
        "key",
        "location",
        "content",
        "mime",
      );
      expect(response).toEqual({ event: "upload.id", data: files });
    });

    it("deve buscar com filtros parciais", async () => {
      const files = [{ id: "1" }] as any;
      uploadServiceMock.searchFile.mockResolvedValue(files);

      const response = await gateway.searchUpload({ bucket: "bucket" });

      expect(uploadServiceMock.searchFile).toHaveBeenCalledWith(
        "bucket",
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(response).toEqual({ event: "upload.id", data: files });
    });

    it("deve retornar error.response quando houver erro com response", async () => {
      uploadServiceMock.searchFile.mockRejectedValue({
        response: { message: "search failed" },
      });

      const response = await gateway.searchUpload({ bucket: "bucket" });

      expect(response).toEqual({
        event: "error",
        data: { message: "search failed" },
      });
    });

    it("deve retornar o próprio erro quando não houver response", async () => {
      uploadServiceMock.searchFile.mockRejectedValue(new Error("boom"));

      const response = await gateway.searchUpload({ bucket: "bucket" });

      expect(response).toEqual({ event: "error", data: expect.any(Error) });
    });
  });

  describe("createUpload", () => {
    it("deve enviar mensagem com userId, file e bucket", () => {
      const client = {} as any;
      webSocketServiceMock.getUserIdBySocket.mockReturnValue("user-1");
      uploadProducerServiceMock.sendMessage.mockReturnValue({ ok: true });

      const response = gateway.createUpload(
        { file: "base64-file" as any, bucket: "bucket-1" },
        client,
      );

      expect(webSocketServiceMock.getUserIdBySocket).toHaveBeenCalledWith(
        client,
      );
      expect(uploadProducerServiceMock.sendMessage).toHaveBeenCalledWith(
        "upload.create",
        {
          userId: "user-1",
          file: "base64-file",
          bucket: "bucket-1",
        },
      );
      expect(response).toEqual({ ok: true });
    });

    it("deve retornar error quando getUserIdBySocket lançar erro", () => {
      const client = {} as any;
      webSocketServiceMock.getUserIdBySocket.mockImplementation(() => {
        throw new Error("socket error");
      });

      const response = gateway.createUpload(
        { file: "base64-file" as any, bucket: "bucket-1" },
        client,
      );

      expect(response).toEqual({
        event: "error",
        data: expect.any(Error),
      });
    });

    it("deve retornar error.response quando erro tiver response", () => {
      const client = {} as any;
      const error = { response: { message: "fail" } };
      webSocketServiceMock.getUserIdBySocket.mockImplementation(() => {
        throw error;
      });

      const response = gateway.createUpload(
        { file: "base64-file" as any, bucket: "bucket-1" },
        client,
      );

      expect(response).toEqual({
        event: "error",
        data: { message: "fail" },
      });
    });
  });

  describe("deleteUpload", () => {
    it("deve enviar mensagem de delete com userId e id", () => {
      const client = {} as any;
      webSocketServiceMock.getUserIdBySocket.mockReturnValue("user-1");
      uploadProducerServiceMock.sendMessage.mockReturnValue({ ok: true });

      const response = gateway.deleteUpload({ id: "file-1" }, client);

      expect(webSocketServiceMock.getUserIdBySocket).toHaveBeenCalledWith(
        client,
      );
      expect(uploadProducerServiceMock.sendMessage).toHaveBeenCalledWith(
        "upload.delete",
        {
          userId: "user-1",
          id: "file-1",
        },
      );
      expect(response).toEqual({ ok: true });
    });

    it("deve retornar error quando getUserIdBySocket lançar erro", () => {
      const client = {} as any;
      webSocketServiceMock.getUserIdBySocket.mockImplementation(() => {
        throw new Error("socket error");
      });

      const response = gateway.deleteUpload({ id: "file-1" }, client);

      expect(response).toEqual({
        event: "error",
        data: expect.any(Error),
      });
    });

    it("deve retornar error.response quando erro tiver response", () => {
      const client = {} as any;
      const error = { response: { message: "fail" } };
      webSocketServiceMock.getUserIdBySocket.mockImplementation(() => {
        throw error;
      });

      const response = gateway.deleteUpload({ id: "file-1" }, client);

      expect(response).toEqual({
        event: "error",
        data: { message: "fail" },
      });
    });
  });
});

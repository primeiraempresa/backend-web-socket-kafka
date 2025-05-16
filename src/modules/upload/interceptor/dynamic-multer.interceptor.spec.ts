import { DynamicMulterInterceptor } from "./dynamic-multer.interceptor";
import { UploadService } from "../services/upload.service";
import { ExecutionContext, CallHandler } from "@nestjs/common";
import { firstValueFrom, of } from "rxjs"; // Importando firstValueFrom
import { s3 } from "@config/s3.config";
import * as multer from "multer";

jest.mock("@config/s3.config", () => ({
  s3: {
    send: jest.fn(),
  },
}));

jest.mock("multer", () => {
  return jest.fn().mockImplementation(() => ({
    single: jest.fn().mockReturnValue((req, res, cb) => {
      req.file = {
        location: "http://localhost/fake-file.jpg",
      };
      cb(null);
    }),
  }));
});

describe("DynamicMulterInterceptor", () => {
  let interceptor: DynamicMulterInterceptor;
  let mockUploadService: UploadService;

  beforeEach(() => {
    mockUploadService = {
      GetTypes: jest.fn().mockResolvedValue(["image/jpeg", "image/png"]),
      upload: jest.fn().mockResolvedValue({
        location: "http://localhost/fake-file.jpg",
      }),
    } as any;

    interceptor = new DynamicMulterInterceptor(mockUploadService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          params: { bucket: "test-bucket" },
        }),
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
  };

  it("should create the bucket if it does not exist and upload the file", async () => {
    // Simula bucket inexistente
    (s3.send as jest.Mock).mockImplementation((command) => {
      if (command.constructor.name === "HeadBucketCommand") {
        const err = new Error("NotFound");
        (err as any).name = "NotFound";
        (err as any).$metadata = { httpStatusCode: 404 };
        return Promise.reject(err);
      }
      return Promise.resolve();
    });

    const context = createMockExecutionContext();
    const next: CallHandler = {
      handle: () => of(null),
    };

    const result$ = await interceptor.intercept(context, next);

    // Espera a resposta do Observable como uma Promise
    const result = await firstValueFrom(result$);

    expect(mockUploadService.GetTypes).toHaveBeenCalled();
    expect(mockUploadService.upload).toHaveBeenCalledWith({
      location: "http://localhost/fake-file.jpg",
    });
    expect(result).toEqual({
      location: "http://localhost/fake-file.jpg",
    });
  });

  it("should skip bucket creation if it already exists", async () => {
    (s3.send as jest.Mock).mockResolvedValueOnce({}); // HeadBucketCommand success

    const context = createMockExecutionContext();
    const next: CallHandler = {
      handle: () => of(null),
    };

    const result$ = await interceptor.intercept(context, next);

    // Espera a resposta do Observable como uma Promise
    const result = await firstValueFrom(result$);

    expect(s3.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ Bucket: "test-bucket" }),
      }),
    );

    expect(mockUploadService.upload).toHaveBeenCalled();
    expect(result).toEqual({
      location: "http://localhost/fake-file.jpg",
    });
  });

  it("should propagate multer error", async () => {
    // Mock erro no multer
    const multerMock = require("multer");
    multerMock.mockImplementation(() => ({
      single: jest.fn().mockReturnValue((req, res, cb) => {
        cb(new Error("Multer error"));
      }),
    }));

    interceptor = new DynamicMulterInterceptor(mockUploadService);

    const context = createMockExecutionContext();
    const next: CallHandler = {
      handle: () => of(null),
    };

    const result$ = await interceptor.intercept(context, next);

    // Espera o erro do multer ser propagado
    try {
      await firstValueFrom(result$);
      // Se chegou aqui, falhou, pois era esperado um erro
      throw new Error("Expected multer error");
    } catch (err) {
      expect(err.message).toBe("Multer error");
    }
  });
});

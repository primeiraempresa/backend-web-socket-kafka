import { Logger } from "@nestjs/common";
import { DynamicMulterInterceptor } from "./dynamic-multer.interceptor";
import { UploadService } from "../services/upload.service";
import { Test, TestingModule } from "@nestjs/testing";

describe("DynamicMulterInterceptor", () => {
  let interceptor: DynamicMulterInterceptor;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DynamicMulterInterceptor],
    }).compile();

    interceptor = module.get<DynamicMulterInterceptor>(
      DynamicMulterInterceptor,
    );
  });

  it("should be defined", () => {
    expect(interceptor).toBeDefined();
  });
});

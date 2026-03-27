import { ArgumentsHost } from "@nestjs/common";
import { MongoExceptionFilter } from "./mongo-exception.filter";

describe("MongoExceptionFilter", () => {
  let filter: MongoExceptionFilter;

  beforeEach(() => {
    filter = new MongoExceptionFilter();
  });

  it("should return a 400 response when MongoDB duplicate key error occurs", () => {
    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    const response = {
      status: statusMock,
    };

    const host = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(response),
      }),
    } as unknown as ArgumentsHost;

    const exception = {
      code: 11000,
      keyValue: {
        email: "test@example.com",
      },
    };

    filter.catch(exception, host);

    expect(host.switchToHttp).toHaveBeenCalledTimes(1);
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 400,
      message: "email 'test@example.com' It is already in use.",
    });
  });

  it("should throw the original exception when it is not a duplicate key error", () => {
    const host = {
      switchToHttp: jest.fn(),
    } as unknown as ArgumentsHost;

    const exception = new Error("Some other error");

    expect(() => filter.catch(exception, host)).toThrow(exception);
  });
});

import { ExceptionFilter, Catch, ArgumentsHost } from "@nestjs/common";

@Catch()
export class MongoExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    if (exception.code === 11000) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse();

      const field = Object.keys(exception.keyValue)[0];
      const value = exception.keyValue[field];

      return response.status(400).json({
        statusCode: 400,
        message: `${field} '${value}' It is already in use.`,
      });
    }

    throw exception;
  }
}

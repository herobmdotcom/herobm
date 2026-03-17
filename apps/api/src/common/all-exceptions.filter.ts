import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter that catches ALL unhandled exceptions and:
 * 1. Logs structured JSON to stdout (→ Promtail → Loki)
 * 2. Returns a standard error response to the client
 *
 * This ensures 500-class errors are visible in the PLG stack,
 * not just in `docker logs`. See ADV-030.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : exception instanceof Error
          ? exception.message
          : String(exception);

    const stack = exception instanceof Error ? exception.stack : undefined;

    // Structured JSON log for Loki parsing
    const logPayload = {
      event: 'unhandled_exception',
      method: request.method,
      path: request.url,
      statusCode,
      message,
      stack: stack ?? null,
      timestamp: new Date().toISOString(),
    };

    if (statusCode >= 500) {
      this.logger.error(JSON.stringify(logPayload));
    } else {
      this.logger.warn(JSON.stringify(logPayload));
    }

    response.status(statusCode).json({
      statusCode,
      message,
      timestamp: logPayload.timestamp,
      path: request.url,
    });
  }
}

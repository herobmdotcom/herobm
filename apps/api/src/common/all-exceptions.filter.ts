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
 * 1. Logs structured JSON to stdout (for local logging / centralized observability)
 * 2. Returns a standard error response to the client
 *
 * This ensures 500-class errors are structured for centralized observability,
 * not just in `docker logs`. See ADV-030.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Native DB Constraint Mapping (ADV-030 enhancement)
    const pgCode =
      (exception as Record<string, unknown>)?.code ||
      ((exception as Record<string, unknown>)?.cause as Record<string, unknown>)
        ?.code;
    const pgDetail =
      (exception as Record<string, unknown>)?.detail ||
      ((exception as Record<string, unknown>)?.cause as Record<string, unknown>)
        ?.detail;

    if (pgCode === '23505') {
      statusCode = HttpStatus.CONFLICT;
    } else if (pgCode === '23503') {
      statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
    } else if (pgCode === '23514') {
      statusCode = HttpStatus.BAD_REQUEST;
    }

    let message =
      exception instanceof HttpException
        ? (exception.getResponse() as Record<string, unknown>).message ||
          exception.message
        : exception instanceof Error
          ? exception.message
          : String(exception);

    if (pgCode && pgDetail) {
      message = `${message as string} (DB Detail: ${pgDetail as string})`;
    }

    const stack = exception instanceof Error ? exception.stack : undefined;

    // Structured JSON log for local log parsing
    const isServerError = statusCode >= 500;
    const logPayload = {
      event: isServerError ? 'unhandled_exception' : 'client_error',
      method: request.method,
      path: request.url,
      statusCode,
      message,
      stack: isServerError && stack ? stack : null,
      timestamp: new Date().toISOString(),
    };

    if (isServerError) {
      this.logger.error(JSON.stringify(logPayload));
    } else {
      this.logger.debug(JSON.stringify(logPayload));
    }

    // If the exception has a rich object response (e.g. { message: 'INVENTORY_GAP', gaps: [...] }) we want to pass that out.
    let additionalProps = {};
    if (exception instanceof HttpException) {
      const resp = exception.getResponse();
      if (typeof resp === 'object' && resp !== null) {
        additionalProps = { ...resp };
      }
    }

    response.status(statusCode).json({
      statusCode,
      message,
      timestamp: logPayload.timestamp,
      path: request.url,
      ...additionalProps,
    });
  }
}

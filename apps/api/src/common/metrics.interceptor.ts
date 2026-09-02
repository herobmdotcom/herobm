import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { getMeter } from '@herobm/shared';

/**
 * Intercepts every HTTP request to:
 * 1. Log structured request/response data (method, path, status, duration)
 * 2. Record OpenTelemetry metrics (request count + latency histogram sockets)
 */

const meter = getMeter('herobm-api');

const httpRequestDuration = meter.createHistogram(
  'http_request_duration_seconds',
  {
    description: 'Duration of HTTP requests in seconds',
    unit: 's',
  },
);

const httpRequestTotal = meter.createCounter('http_requests_total', {
  description: 'Total number of HTTP requests',
});

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          const duration = (Date.now() - startTime) / 1000;
          const statusCode = res.statusCode;

          // Route label uses the controller path pattern, not the actual URL
          const route = req.route?.path ?? url.split('?')[0];

          const attributes = {
            'http.method': method,
            'http.route': route,
            'http.status_code': statusCode,
            method,
            route,
            status_code: String(statusCode),
          };

          httpRequestDuration.record(duration, attributes);
          httpRequestTotal.add(1, attributes);

          this.logger.log(
            `${method} ${url} ${statusCode} ${(duration * 1000).toFixed(0)}ms`,
          );
        },
        error: (err) => {
          const duration = (Date.now() - startTime) / 1000;
          const statusCode = err.status ?? 500;
          const route = req.route?.path ?? url.split('?')[0];

          const attributes = {
            'http.method': method,
            'http.route': route,
            'http.status_code': statusCode,
            method,
            route,
            status_code: String(statusCode),
          };

          httpRequestDuration.record(duration, attributes);
          httpRequestTotal.add(1, attributes);

          this.logger.warn(
            `${method} ${url} ${statusCode} ${(duration * 1000).toFixed(0)}ms — ${err.message}`,
          );
        },
      }),
    );
  }
}

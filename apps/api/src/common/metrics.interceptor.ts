import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Histogram, Counter } from 'prom-client';

/**
 * Intercepts every HTTP request to:
 * 1. Log structured request/response data (method, path, status, duration)
 * 2. Record Prometheus metrics (request count + latency histogram)
 */

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
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

          httpRequestDuration
            .labels(method, route, String(statusCode))
            .observe(duration);
          httpRequestTotal.labels(method, route, String(statusCode)).inc();

          this.logger.log(
            `${method} ${url} ${statusCode} ${(duration * 1000).toFixed(0)}ms`,
          );
        },
        error: (err) => {
          const duration = (Date.now() - startTime) / 1000;
          const statusCode = err.status ?? 500;
          const route = req.route?.path ?? url.split('?')[0];

          httpRequestDuration
            .labels(method, route, String(statusCode))
            .observe(duration);
          httpRequestTotal.labels(method, route, String(statusCode)).inc();

          this.logger.warn(
            `${method} ${url} ${statusCode} ${(duration * 1000).toFixed(0)}ms — ${err.message}`,
          );
        },
      }),
    );
  }
}

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Intercepts responses and filters fields based on the `?fields=` query parameter.
 * This is primarily used to optimize payloads for AI agents.
 */
@Injectable()
export class FieldMaskInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const fieldsQuery = request.query.fields;

    if (!fieldsQuery || typeof fieldsQuery !== 'string') {
      return next.handle();
    }

    const requestedFields = new Set(
      fieldsQuery.split(',').map((f) => f.trim()),
    );

    return next.handle().pipe(
      map((data) => {
        return this.filterFields(data, requestedFields);
      }),
    );
  }

  private filterFields(data: unknown, fields: Set<string>): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.filterFields(item, fields));
    }

    if (typeof data === 'object') {
      // If the response wraps data in pagination or data objects, traverse down
      if (
        'data' in data &&
        Array.isArray((data as Record<string, unknown>).data)
      ) {
        return {
          ...data,
          data: ((data as Record<string, unknown>).data as unknown[]).map(
            (item: unknown) => this.filterFields(item, fields),
          ),
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filtered: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (fields.has(key)) {
          filtered[key] = value;
        }
      }
      return filtered;
    }

    return data;
  }
}

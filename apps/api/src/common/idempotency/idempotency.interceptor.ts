import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  Logger,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError, from, of } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import type { DrizzleDB } from '../../drizzle/drizzle.module';
import * as schema from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import type { Column } from 'drizzle-orm';
import { IDEMPOTENT_KEY, IdempotentConfig } from './idempotent.decorator';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    @Optional() @Inject(DRIZZLE) private db: DrizzleDB,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const config = this.reflector.get<IdempotentConfig>(
      IDEMPOTENT_KEY,
      context.getHandler(),
    );

    if (!config) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    // Extract the client-generated ID from the body
    const clientId = req.body?.[config.idBodyPath];

    if (!clientId) {
      // If the endpoint is marked idempotent but no ID is provided, we just let it proceed
      // (the DTO validation should catch missing IDs if they are mandatory).
      return next.handle();
    }

    return next.handle().pipe(
      catchError((error) => {
        // Postgres UniqueConstraintViolation code is '23505'
        if (error.code === '23505') {
          // If the unique violation is on the primary key, it means this record already exists
          // We intercept the error, query the existing record, and return it as 200 OK
          this.logger.debug(
            `Idempotency retry detected for ${config.queryKey} (ID: ${clientId}). Fetching existing record.`,
          );

          return from(this.fetchExistingRecord(config, clientId)).pipe(
            mergeMap((existingRecord) => {
              if (existingRecord) {
                // Change HTTP status from 201 Created to 200 OK to indicate it's a fetched retry
                res.status(200);
                return of(existingRecord);
              }
              // If we couldn't find the record, fallback to throwing the original error
              return throwError(() => error);
            }),
          );
        }
        return throwError(() => error);
      }),
    );
  }

  private async fetchExistingRecord(
    config: IdempotentConfig,
    id: string,
  ): Promise<unknown> {
    try {
      const schemaRecord = schema as unknown as Record<
        string,
        Record<string, Column>
      >;
      const table = schemaRecord[config.queryKey];
      if (!table) {
        this.logger.error(
          `Table ${config.queryKey} not found in schema export.`,
        );
        return null;
      }
      const column = table[config.pkField];
      if (!column) {
        this.logger.error(
          `Column ${config.pkField} not found on table ${config.queryKey}.`,
        );
        return null;
      }

      // Perform a dynamic relational query
      const dbQuery = this.db.query as Record<
        string,
        { findFirst: (args: unknown) => Promise<unknown> }
      >;
      const result = await dbQuery[config.queryKey].findFirst({
        where: eq(column, id),
      });

      return result;
    } catch (err) {
      this.logger.error(`Failed to fetch existing idempotent record: ${err}`);
      return null;
    }
  }
}

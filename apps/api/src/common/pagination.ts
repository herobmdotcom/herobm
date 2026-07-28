import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiOkResponse,
  getSchemaPath,
  ApiProperty,
  ApiExtraModels,
  ApiHideProperty,
} from '@nestjs/swagger';

export * from './pagination.dto';
import { PaginationQuery } from './pagination.dto';

/**
 * Canonical paginated response.
 *
 * All list endpoints must return this shape: { data, limit, total, nextCursor, prevCursor }.
 */
export class PaginatedResponse<T> {
  data: T[];
  @ApiProperty()
  limit: number;
  @ApiProperty({ required: false })
  page?: number;
  @ApiProperty({ required: false })
  total?: number; // Optional, total rows can be slow
  @ApiProperty({ required: false })
  nextCursor?: string;
  @ApiProperty({ required: false })
  prevCursor?: string;
}

export function ApiPaginatedResponse<TModel extends Type<unknown>>(
  model: TModel,
) {
  return applyDecorators(
    ApiExtraModels(PaginatedResponse, model),
    ApiOkResponse({
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(model) },
          },
          limit: { type: 'number' },
          page: { type: 'number', nullable: true },
          total: { type: 'number', nullable: true },
          nextCursor: { type: 'string', nullable: true },
          prevCursor: { type: 'string', nullable: true },
        },
        required: ['data', 'limit'],
      },
    }),
  );
}

export function parsePagination(query?: PaginationQuery) {
  const page = query?.page ?? 1;
  const limit = Math.min(query?.limit ?? 50, 100_000);
  const offset = (page - 1) * limit;
  const searchTerm = query?.q ? `%${query.q}%` : null;
  const includeArchived = query?.includeArchived ?? false;
  const customerId = query?.customerId;
  const vendorId = query?.vendorId;
  const days = query?.days;
  const purchaseOrderId = query?.purchaseOrderId;
  const states = query?.state
    ? query.state.split(',').map((s) => s.trim())
    : null;

  return {
    page,
    offset,
    limit,
    cursor: query?.cursor ? decodeCursor(query.cursor) : null,
    direction: query?.direction ?? 'next',
    searchTerm,
    includeArchived,
    customerId,
    vendorId,
    days,
    purchaseOrderId,
    states,
  };
}

export function encodeCursor(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function decodeCursor<T = unknown>(cursor: string): T | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch (e) {
    return null;
  }
}

/**
 * Build a PaginatedResponse from a pre-paginated result set and total count.
 */
export function paginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return { data, page, limit, total };
}

/**
 * Build a PaginatedResponse by slicing a full in-memory array.
 * Use only for bounded/small datasets (e.g. ABM migration-period merge).
 */
export function paginate<T>(
  items: T[],
  page: number,
  limit: number,
): PaginatedResponse<T> {
  const offset = (page - 1) * limit;
  return {
    data: items.slice(offset, offset + limit),
    page,
    limit,
    total: items.length,
  };
}

/**
 * Apply Keyset / Cursor pagination to a Drizzle QueryBuilder.
 *
 * IMPORTANT: You must provide a custom `applyWhere` callback because Drizzle ORM
 * lacks a fully generic way to build `(colA > valA) OR (colA = valA AND colB > valB)`
 * without losing type safety on the specific table columns.
 *
 * Example usage:
 * ```ts
 * const { data, nextCursor, prevCursor } = await withCursorPagination({
 *   qb,
 *   limit,
 *   cursorObj,
 *   direction,
 *   applyWhere: (q, cursor, dir) => {
 *     const op = dir === 'next' ? gt : lt;
 *     return q.where(op(table.id, cursor.id));
 *   },
 *   applyOrderBy: (q, dir) => {
 *     const op = dir === 'next' ? asc : desc;
 *     return q.orderBy(op(table.id));
 *   },
 *   encodeRow: (row) => ({ id: row.id })
 * });
 * ```
 */
export async function withCursorPagination<
  TQuery extends { limit: (l: number) => unknown },
  TCursor,
  T = TQuery extends PromiseLike<(infer U)[]> ? U : unknown,
>({
  qb,
  limit,
  cursorObj,
  direction,
  applyWhere,
  applyOrderBy,
  encodeRow,
}: {
  qb: TQuery;
  limit: number;
  cursorObj: TCursor;
  direction: 'next' | 'prev';
  applyWhere: (
    q: TQuery,
    cursor: NonNullable<TCursor>,
    dir: 'next' | 'prev',
  ) => TQuery;
  applyOrderBy: (q: TQuery, dir: 'next' | 'prev') => TQuery;
  encodeRow: (row: T) => Record<string, unknown>;
}): Promise<{ data: T[]; nextCursor?: string; prevCursor?: string }> {
  let query = qb;

  if (cursorObj) {
    query = applyWhere(query, cursorObj, direction);
  }

  query = applyOrderBy(query, direction);
  const finalQuery = query.limit(limit + 1);
  const rawRows = (await finalQuery) as T[];
  const hasMore = rawRows.length > limit;
  const rows = hasMore ? rawRows.slice(0, limit) : rawRows;

  if (direction === 'prev') {
    rows.reverse();
  }

  let nextCursor: string | undefined;
  let prevCursor: string | undefined;

  if (direction === 'next') {
    nextCursor =
      hasMore && rows.length > 0
        ? encodeCursor(encodeRow(rows[rows.length - 1]))
        : undefined;
    prevCursor =
      cursorObj && rows.length > 0
        ? encodeCursor(encodeRow(rows[0]))
        : undefined;
  } else {
    prevCursor =
      hasMore && rows.length > 0 ? encodeCursor(encodeRow(rows[0])) : undefined;
    nextCursor =
      rows.length > 0
        ? encodeCursor(encodeRow(rows[rows.length - 1]))
        : undefined;
  }

  return { data: rows, nextCursor, prevCursor };
}

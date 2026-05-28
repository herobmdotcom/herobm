import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Canonical pagination query parameters (ADV-041).
 *
 * Every list endpoint should accept this shape via `@Query()`.
 * Standardises the search param name (`q`) and pagination model (`page`/`limit`).
 *
 * Usage:
 *   @Get()
 *   findAll(@Query() query: PaginationQuery) { ... }
 *
 * Enforced by: infra/tests/test_pagination_conventions.ps1
 */
export class PaginationQuery {
  /** Full-text search term */
  @IsOptional()
  @IsString()
  q?: string;

  /** 1-based page number (default: 1) */
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  page?: number;

  /** Base64 encoded cursor */
  @IsOptional()
  @IsString()
  cursor?: string;

  /** Pagination direction */
  @IsOptional()
  @IsString()
  direction?: 'next' | 'prev';

  /** Maximum results per page (default: 50, max: 100000) */
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  limit?: number;

  /** Optional state filter */
  @IsOptional()
  @IsString()
  state?: string;

  /** Whether to include archived records */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeArchived?: boolean;

  /** Optional filter by customer/customer ID */
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  days?: number;

  /** Optional filter by purchase order ID */
  @IsOptional()
  @IsString()
  purchaseOrderId?: string;
}

import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiOkResponse,
  getSchemaPath,
  ApiProperty,
  ApiExtraModels,
  ApiHideProperty,
} from '@nestjs/swagger';

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

export function ApiPaginatedResponse<TModel extends Type<any>>(model: TModel) {
  return applyDecorators(
    ApiExtraModels(PaginatedResponse, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponse) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
            },
          },
        ],
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
    days,
    purchaseOrderId,
    states,
  };
}

export function encodeCursor(payload: any): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function decodeCursor<T = any>(cursor: string): T | null {
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
export async function withCursorPagination<T = any>({
  qb,
  limit,
  cursorObj,
  direction,
  applyWhere,
  applyOrderBy,
  encodeRow,
}: {
  qb: any;
  limit: number;
  cursorObj: any;
  direction: 'next' | 'prev';
  applyWhere: (q: any, cursor: any, dir: 'next' | 'prev') => any;
  applyOrderBy: (q: any, dir: 'next' | 'prev') => any;
  encodeRow: (row: T) => any;
}): Promise<{ data: T[]; nextCursor?: string; prevCursor?: string }> {
  let query = qb;

  if (cursorObj) {
    query = applyWhere(query, cursorObj, direction);
  }

  query = applyOrderBy(query, direction);
  query = query.limit(limit + 1);

  const rawRows = await query;
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

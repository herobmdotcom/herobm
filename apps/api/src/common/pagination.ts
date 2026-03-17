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

  /** Maximum results per page (default: 50, max: 100000) */
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  limit?: number;

  /** Optional state filter */
  @IsOptional()
  @IsString()
  state?: string;
}

/**
 * Canonical paginated response.
 *
 * All list endpoints must return this shape: { data, page, limit, total }.
 */
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

/**
 * Parse canonical pagination params from a PaginationQuery.
 * Returns { page, limit, offset, searchTerm }.
 */
export function parsePagination(query?: PaginationQuery) {
  const page = query?.page ?? 1;
  const limit = Math.min(query?.limit ?? 50, 100_000);
  const offset = (page - 1) * limit;
  const searchTerm = query?.q ? `%${query.q}%` : null;
  return { page, limit, offset, searchTerm };
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

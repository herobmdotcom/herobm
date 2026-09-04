import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Standard pagination query parameters
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

  /** Optional filter by supplier/vendor ID */
  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'string' && value.toLowerCase() === 'mtd')
      return 'mtd';
    const num = Number(value);
    return isNaN(num) ? value : num;
  })
  days?: number | string;

  /** Optional filter by purchase order ID */
  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  /** Optional filter by product ID */
  @IsOptional()
  @IsString()
  productId?: string;

  /** Optional filter by opportunity ID */
  @IsOptional()
  @IsString()
  opportunityId?: string;

  /** Optional filter by project ID (alias for opportunityId) */
  @IsOptional()
  @IsString()
  projectId?: string;

  /** Field to sort by */
  @IsOptional()
  @IsString()
  sort?: string;

  /** Sort direction (asc/desc) */
  @IsOptional()
  @IsString()
  sortDirection?: 'asc' | 'desc';
}

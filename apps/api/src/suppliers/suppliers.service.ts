import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { suppliers as martSuppliers } from '../drizzle/schema';
import {
  suppliers as coreSuppliers,
  supplierEvents,
} from '../drizzle/modbm-core-schema';
import { eq, ilike, or, sql, and } from 'drizzle-orm';
import { PaginationQuery, parsePagination } from '../common/pagination';

/** Normalize ABM status codes ('A', 'A2', 'S', 'H', '') to 'active' | 'inactive' */
function normalizeStateCode(raw: string | null | undefined): string {
  if (!raw) return 'active';
  const lower = raw.toLowerCase().trim();
  if (lower === 'active' || lower === 'inactive') return lower;
  if (lower.startsWith('s') || lower.startsWith('h')) return 'inactive';
  return 'active';
}

@Injectable()
export class SuppliersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(params: PaginationQuery) {
    const { page, limit, offset, searchTerm, includeArchived } =
      parsePagination(params);

    // --- App suppliers (modbm_core) ---
    let appQuery = this.db
      .select({
        vendorId: coreSuppliers.vendorId,
        vendorNumber: coreSuppliers.vendorNumber,
        name: coreSuppliers.name,
        address1Line1: coreSuppliers.address1Line1,
        address1Line2: coreSuppliers.address1Line2,
        address1City: coreSuppliers.address1City,
        address1StateOrProvince: coreSuppliers.address1StateOrProvince,
        address1PostalCode: coreSuppliers.address1PostalCode,
        address1Country: coreSuppliers.address1Country,
        telephone1: coreSuppliers.telephone1,
        fax: coreSuppliers.fax,
        emailAddress1: coreSuppliers.emailAddress1,
        paymentTerms: coreSuppliers.paymentTerms,
        currencyCode: coreSuppliers.currencyCode,
        stateCode: coreSuppliers.stateCode,
        notes: coreSuppliers.notes,
        createdOn: coreSuppliers.createdOn,
        source: sql<string>`'app'`.as('source'),
      })
      .from(coreSuppliers)
      .$dynamic();

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(coreSuppliers.name, searchTerm),
          ilike(coreSuppliers.vendorNumber, searchTerm),
        ),
      );
    }

    if (!includeArchived) {
      conditions.push(sql`${coreSuppliers.stateCode} != 'archived'`);
    }

    if (conditions.length > 0) {
      appQuery = appQuery.where(and(...conditions));
    }

    // --- Mart suppliers (legacy ABM) ---
    let martQuery = this.db
      .select({
        vendorId: martSuppliers.vendorId,
        vendorNumber: martSuppliers.vendorNumber,
        name: martSuppliers.name,
        vendorGroup: martSuppliers.vendorGroup,
        address1Line1: martSuppliers.address1Line1,
        address1Line2: martSuppliers.address1Line2,
        address1City: martSuppliers.address1City,
        address1StateOrProvince: martSuppliers.address1StateOrProvince,
        address1PostalCode: martSuppliers.address1PostalCode,
        address1Country: martSuppliers.address1Country,
        telephone1: martSuppliers.telephone1,
        fax: martSuppliers.fax,
        emailAddress1: martSuppliers.emailAddress1,
        stateCode: martSuppliers.stateCode,
        createdOn: martSuppliers.createdOn,
        productCount: martSuppliers.productCount,
        source: sql<string>`'abm'`.as('source'),
      })
      .from(martSuppliers)
      .$dynamic();

    if (searchTerm) {
      martQuery = martQuery.where(
        or(
          ilike(martSuppliers.name, searchTerm),
          ilike(martSuppliers.vendorNumber, searchTerm),
        ),
      );
    }

    const [appRows, martRows] = await Promise.all([appQuery, martQuery]);
    const normalisedMart = martRows.map((r) => ({
      ...r,
      stateCode: normalizeStateCode(r.stateCode),
    }));
    const unified = [...appRows, ...normalisedMart];

    // Case-insensitive name sort
    unified.sort((a, b) =>
      (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()),
    );

    // Paginate manually
    const data = unified.slice(offset, offset + limit);

    return {
      data,
      page,
      limit,
      total: unified.length,
    };
  }

  async findOne(id: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );

    // 1. Check core if UUID
    if (isUuid) {
      const coreRows = await this.db
        .select()
        .from(coreSuppliers)
        .where(eq(coreSuppliers.vendorId, id))
        .limit(1);

      if (coreRows.length > 0) {
        const events = await this.db
          .select()
          .from(supplierEvents)
          .where(eq(supplierEvents.vendorId, id))
          .orderBy(supplierEvents.createdOn);

        return { ...coreRows[0], source: 'app', events };
      }
    }

    // 2. Check mart table
    const martRows = await this.db
      .select()
      .from(martSuppliers)
      .where(eq(martSuppliers.vendorId, id))
      .limit(1);

    if (martRows.length > 0) {
      return {
        ...martRows[0],
        stateCode: normalizeStateCode(martRows[0].stateCode),
        source: 'abm',
        events: [],
      };
    }

    throw new NotFoundException(`Supplier '${id}' not found`);
  }

  /** Products supplied by a given vendor (legacy mart) */
  async findSupplierProducts(vendorId: string) {
    // Note: this only works for legacy vendors in mart
    const { productSuppliers } = await import('../drizzle/schema.js');
    return this.db
      .select()
      .from(productSuppliers)
      .where(eq(productSuppliers.vendorId, vendorId));
  }
}

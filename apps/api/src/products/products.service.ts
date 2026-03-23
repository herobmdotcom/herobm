import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, ilike, or, sql, and } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { products as martProducts } from '../drizzle/schema';
import {
  products as coreProducts,
  productEvents,
} from '../drizzle/modbm-core-schema';
import { PaginationQuery, parsePagination } from '../common/pagination';

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

@Injectable()
export class ProductsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(query?: PaginationQuery) {
    const { page, limit, offset, searchTerm, includeArchived } =
      parsePagination(query);

    // --- App products (modbm_core) ---
    let appQuery = this.db
      .select({
        productId: coreProducts.productId,
        productNumber: coreProducts.productNumber,
        name: coreProducts.name,
        barcode: coreProducts.barcode,
        listPrice: coreProducts.listPrice,
        standardCost: coreProducts.standardCost,
        tradePrice: coreProducts.tradePrice,
        priceLevel3: coreProducts.priceLevel3,
        priceLevel4: coreProducts.priceLevel4,
        stateCode: coreProducts.stateCode,
        notes: coreProducts.notes,
        createdBy: coreProducts.createdBy,
        createdOn: coreProducts.createdOn,
        source: sql<string>`'app'`.as('source'),
      })
      .from(coreProducts)
      .$dynamic();

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(coreProducts.name, searchTerm),
          ilike(coreProducts.productNumber, searchTerm),
          ilike(coreProducts.barcode, searchTerm),
        ),
      );
    }

    if (!includeArchived) {
      conditions.push(sql`${coreProducts.stateCode} != 'archived'`);
    }

    if (conditions.length > 0) {
      appQuery = appQuery.where(and(...conditions));
    }

    // --- Mart products (legacy ABM) ---
    let martQuery = this.db
      .select({
        productId: martProducts.productId,
        productNumber: martProducts.productNumber,
        name: martProducts.name,
        productGroupName: martProducts.productGroupName,
        defaultVendorId: martProducts.defaultVendorId,
        defaultVendorName: martProducts.defaultVendorName,
        standardCost: martProducts.standardCost,
        listPrice: martProducts.listPrice,
        tradePrice: martProducts.tradePrice,
        priceLevel3: martProducts.priceLevel3,
        priceLevel4: martProducts.priceLevel4,
        barcode: martProducts.barcode,
        stateCode: martProducts.stateCode,
        gstCategory: martProducts.gstCategory,
        scNumber: martProducts.scNumber,
        createdOn: martProducts.createdOn,
        source: sql<string>`'abm'`.as('source'),
      })
      .from(martProducts)
      .$dynamic();

    if (searchTerm) {
      martQuery = martQuery.where(
        or(
          ilike(martProducts.name, searchTerm),
          ilike(martProducts.productNumber, searchTerm),
          ilike(martProducts.barcode, searchTerm),
        ),
      );
    }

    // Execute both and merge (core products first for relevance)
    const [appRows, martRows] = await Promise.all([appQuery, martQuery]);

    const unified = [...appRows, ...martRows];

    // Simple in-memory sorting by name
    unified.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // Paginate manually
    const data = unified.slice(offset, offset + limit);

    return { data, page, limit, total: unified.length };
  }

  async findOne(id: string) {
    // 1. Check core first (only if it looks like a UUID)
    if (isUuid(id)) {
      const coreRows = await this.db
        .select()
        .from(coreProducts)
        .where(eq(coreProducts.productId, id))
        .limit(1);

      if (coreRows.length > 0) {
        const events = await this.db
          .select()
          .from(productEvents)
          .where(eq(productEvents.productId, id))
          .orderBy(productEvents.createdOn);

        return { ...coreRows[0], source: 'app', events };
      }
    }

    // 2. Check mart
    const martRows = await this.db
      .select()
      .from(martProducts)
      .where(eq(martProducts.productId, id))
      .limit(1);

    if (martRows.length > 0) {
      return { ...martRows[0], source: 'abm', events: [] };
    }

    throw new NotFoundException(`Product '${id}' not found`);
  }
}

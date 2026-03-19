import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, ilike, or, desc, sql, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { salesOrderLines, accounts } from '../drizzle/schema';
import { salesOrders, salesOrderLineItems } from '../drizzle/modbm-core-schema';
import { PaginationQuery, parsePagination } from '../common/pagination';

/**
 * Unified order shape returned by findAll — merges ABM legacy and app orders.
 * At ABM cutover, remove the ABM query from findAll.
 */
export interface UnifiedOrderRow {
  id: string;
  orderNumber: string;
  name: string;
  customerName: string;
  customerOrderNumber: string;
  stateCode: string;
  source: 'abm' | 'app';
  createdBy: string;
  createdOn: string | null;
  totalPrice: string | null;
  currencyCode: string | null;
}

@Injectable()
export class OrdersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  /**
   * Unified order list: unions ABM mart orders + app orders.
   * ABM mart data is line-level — we SELECT DISTINCT ON document_number
   * to get one row per order.
   *
   * At cutover: remove the ABM query and return only app orders.
   */
  async findAll(query?: PaginationQuery) {
    const { page, limit, offset, searchTerm, includeArchived } =
      parsePagination(query);

    // --- ABM legacy orders (deduplicated by document_number) ---
    let abmQuery = this.db
      .selectDistinctOn([salesOrderLines.documentNumber], {
        id: salesOrderLines.salesOrderLineId,
        orderNumber: salesOrderLines.documentNumber,
        name: salesOrderLines.accountName,
        customerOrderNumber: salesOrderLines.customerOrderNumber,
        stateCode: sql<string>`'legacy'`.as('state_code_unified'),
        source: sql<string>`'abm'`.as('source'),
        createdBy: sql<string>`''`.as('created_by'),
        createdOn: salesOrderLines.documentDate,
        totalPrice: salesOrderLines.documentTotalIncTax,
      })
      .from(salesOrderLines)
      .$dynamic();

    if (searchTerm) {
      abmQuery = abmQuery.where(
        or(
          ilike(salesOrderLines.documentNumber, searchTerm),
          ilike(salesOrderLines.accountName, searchTerm),
          ilike(salesOrderLines.customerOrderNumber, searchTerm),
        ),
      );
    }

    // --- App orders (join accounts for customer name) ---
    let appQuery = this.db
      .select({
        id: salesOrders.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        name: salesOrders.name,
        customerName: accounts.name,
        customerOrderNumber: salesOrders.customerOrderNumber,
        stateCode: salesOrders.stateCode,
        source: sql<string>`'app'`.as('source'),
        createdBy: salesOrders.createdBy,
        createdOn: salesOrders.createdOn,
        currencyCode: salesOrders.currencyCode,
      })
      .from(salesOrders)
      .leftJoin(accounts, eq(salesOrders.customerId, accounts.accountId))
      .$dynamic();

    if (searchTerm) {
      appQuery = appQuery.where(
        or(
          ilike(salesOrders.orderNumber, searchTerm),
          ilike(salesOrders.name, searchTerm),
          ilike(salesOrders.customerOrderNumber, searchTerm),
          ilike(accounts.name, searchTerm),
        ),
      );
    }

    if (!includeArchived) {
      appQuery = appQuery.where(sql`${salesOrders.stateCode} != 'archived'`);
    }

    // Execute both and merge (app first, then ABM)
    const [appRows, abmRows] = await Promise.all([appQuery, abmQuery]);

    // --- Aggregate line totals per app order ---
    const appTotalMap = new Map<string, string>();
    const appOrderIds = appRows.map((r) => r.id);
    if (appOrderIds.length > 0) {
      const totals = await this.db
        .select({
          salesOrderId: salesOrderLineItems.salesOrderId,
          total: sql<string>`COALESCE(SUM(${salesOrderLineItems.totalAmount}::numeric), 0)::text`,
        })
        .from(salesOrderLineItems)
        .where(inArray(salesOrderLineItems.salesOrderId, appOrderIds))
        .groupBy(salesOrderLineItems.salesOrderId);

      for (const row of totals) {
        appTotalMap.set(row.salesOrderId, row.total);
      }
    }

    const unified: UnifiedOrderRow[] = [
      ...appRows.map((r) => ({
        id: r.id,
        orderNumber: r.orderNumber ?? '',
        name: r.name ?? '',
        customerName: r.customerName ?? '',
        customerOrderNumber: r.customerOrderNumber ?? '',
        stateCode: r.stateCode ?? 'draft',
        source: 'app' as const,
        createdBy: r.createdBy ?? '',
        createdOn: r.createdOn ? new Date(r.createdOn).toISOString() : null,
        totalPrice: appTotalMap.get(r.id) ?? null,
        currencyCode: r.currencyCode ?? 'EUR',
      })),
      ...abmRows.map((r) => ({
        id: r.id,
        orderNumber: r.orderNumber ?? '',
        name: '',
        customerName: r.name ?? '',
        customerOrderNumber: r.customerOrderNumber ?? '',
        stateCode: 'legacy',
        source: 'abm' as const,
        createdBy: '',
        createdOn: r.createdOn ? new Date(r.createdOn).toISOString() : null,
        totalPrice: r.totalPrice ?? null,
        currencyCode: null,
      })),
    ];

    // Paginate the merged result
    const paginated = unified.slice(offset, offset + limit);

    return { data: paginated, page, limit, total: unified.length };
  }

  async findOne(id: string) {
    const rows = await this.db
      .select()
      .from(salesOrderLines)
      .where(eq(salesOrderLines.salesOrderLineId, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Order line '${id}' not found`);
    }
    return rows[0];
  }

  /**
   * Look up all lines for an ABM order by document number.
   * Returns a unified detail shape for the Sales Portal.
   */
  async findAbmOrder(documentNumber: string) {
    const lines = await this.db
      .select()
      .from(salesOrderLines)
      .where(eq(salesOrderLines.documentNumber, documentNumber));

    if (lines.length === 0) {
      throw new NotFoundException(`ABM order '${documentNumber}' not found`);
    }

    const first = lines[0];
    return {
      salesOrderId: null,
      orderNumber: first.documentNumber,
      name: first.accountName,
      customerId: first.accountId,
      customerOrderNumber: first.customerOrderNumber,
      stateCode: 'legacy',
      notes: null,
      createdBy: null,
      createdOn: first.documentDate,
      modifiedOn: first.documentDate,
      source: 'abm' as const,
      lines: lines.map((l, idx) => ({
        salesOrderLineId: l.salesOrderLineId,
        lineNumber: l.lineNumber ?? idx + 1,
        productId: l.productId,
        productNumber: l.productNumber,
        productDescription: l.productDescription,
        quantity: l.quantity,
        pricePerUnit: l.pricePerUnit,
        discountPercentage: l.discountPercentage,
        amount: l.amount,
        tax: l.tax,
        totalAmount: l.totalAmount,
        unitOfMeasure: l.unitOfMeasure,
        quantityPicked: l.quantityDelivered ?? '0',
      })),
      events: [],
    };
  }
}

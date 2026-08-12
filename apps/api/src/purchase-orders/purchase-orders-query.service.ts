import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrders,
  purchaseOrderLineItems,
  procurementEvents,
  suppliers as coreSuppliers,
  products,
  productUoms,
  locations,
  purchaseInvoiceLines,
  actors,
} from '@herobm/db-schema';
import { eq, or, ilike, desc, sql, inArray, and, asc } from 'drizzle-orm';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../common/pagination';
import { PURCHASE_ORDER_STATE } from '@herobm/shared';

export interface UnifiedPurchaseOrderRow {
  id: string;
  orderNumber: string;
  name: string;
  vendorName: string;
  referenceNumber: string;
  stateCode: string;

  createdBy: string;
  createdOn: string | null;
  totalPrice: string | null;
  currencyCode: string | null;

  productQuantity?: string | null;
  productQuantityReceived?: string | null;
}

@Injectable()
export class PurchaseOrdersQueryService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(query?: PaginationQuery) {
    const {
      page,
      limit,
      cursor,
      direction,
      searchTerm,
      includeArchived,
      days,
      states,
      vendorId,
      productId,
    } = parsePagination(query);

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${purchaseOrders.orderNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${purchaseOrders.orderNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${purchaseOrders.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${purchaseOrders.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${actors.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${actors.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(purchaseOrders.orderNumber, `%${rawSearchTerm}%`),
          ilike(purchaseOrders.name, `%${rawSearchTerm}%`),
          ilike(actors.name, `%${rawSearchTerm}%`),
        ),
      );
    }

    if (!includeArchived) {
      conditions.push(
        sql`${purchaseOrders.stateCode} != ${PURCHASE_ORDER_STATE.ARCHIVED}`,
      );
    }

    if (days && days > 0) {
      conditions.push(
        sql`${purchaseOrders.createdOn} >= NOW() - INTERVAL '1 day' * ${days}`,
      );
    }

    if (states && states.length > 0) {
      if (states.length === 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        conditions.push(eq(purchaseOrders.stateCode, states[0] as any));
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        conditions.push(inArray(purchaseOrders.stateCode, states as any[]));
      }
    }

    if (vendorId) {
      conditions.push(eq(purchaseOrders.vendorId, vendorId));
    }

    if (productId) {
      conditions.push(
        inArray(
          purchaseOrders.purchaseOrderId,
          this.db
            .select({ purchaseOrderId: purchaseOrderLineItems.purchaseOrderId })
            .from(purchaseOrderLineItems)
            .where(eq(purchaseOrderLineItems.productId, productId)),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseOrders)
      .leftJoin(
        coreSuppliers,
        eq(purchaseOrders.vendorId, coreSuppliers.vendorId),
      )
      .leftJoin(actors, eq(coreSuppliers.actorId, actors.actorId))
      .where(whereClause);

    // --- App orders ---
    let appQuery = this.db
      .select({
        id: purchaseOrders.purchaseOrderId,
        orderNumber: purchaseOrders.orderNumber,
        name: purchaseOrders.name,
        vendorName: actors.name,
        referenceNumber: purchaseOrders.referenceNumber,
        stateCode: purchaseOrders.stateCode,
        source: sql<string>`'app'`.as('source'),
        createdBy: purchaseOrders.createdBy,
        createdOn: purchaseOrders.createdOn,
        expectedDate: purchaseOrders.expectedDate,
        currencyCode: purchaseOrders.currencyCode,
        score: scoreSql,
      })
      .from(purchaseOrders)
      .leftJoin(
        coreSuppliers,
        eq(purchaseOrders.vendorId, coreSuppliers.vendorId),
      )
      .leftJoin(actors, eq(coreSuppliers.actorId, actors.actorId))
      .$dynamic();

    if (whereClause) {
      appQuery = appQuery.where(whereClause);
    }

    const {
      data: appRows,
      nextCursor,
      prevCursor,
    } = await withCursorPagination({
      qb: appQuery,
      limit,
      cursorObj: cursor as {
        score: number;
        createdOn: string;
        id: string;
      } | null,
      direction: direction,
      applyWhere: (q, c, dir) => {
        const cDate = c.createdOn;
        if (dir === 'next') {
          const cursorCond = or(
            sql`${scoreSql} < ${c.score}`,
            and(
              eq(scoreSql, c.score),
              sql`COALESCE(${purchaseOrders.createdOn}, '1970-01-01T00:00:00.000Z'::timestamp) < ${cDate}::timestamp`,
            ),
            and(
              eq(scoreSql, c.score),
              sql`COALESCE(${purchaseOrders.createdOn}, '1970-01-01T00:00:00.000Z'::timestamp) = ${cDate}::timestamp`,
              sql`${purchaseOrders.purchaseOrderId} < ${c.id}`,
            ),
          );
          return q.where(
            whereClause ? and(whereClause, cursorCond) : cursorCond,
          );
        } else {
          const cursorCond = or(
            sql`${scoreSql} > ${c.score}`,
            and(
              eq(scoreSql, c.score),
              sql`COALESCE(${purchaseOrders.createdOn}, '1970-01-01T00:00:00.000Z'::timestamp) > ${cDate}::timestamp`,
            ),
            and(
              eq(scoreSql, c.score),
              sql`COALESCE(${purchaseOrders.createdOn}, '1970-01-01T00:00:00.000Z'::timestamp) = ${cDate}::timestamp`,
              sql`${purchaseOrders.purchaseOrderId} > ${c.id}`,
            ),
          );
          return q.where(
            whereClause ? and(whereClause, cursorCond) : cursorCond,
          );
        }
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? desc : asc;
        return q.orderBy(
          orderFn(scoreSql),
          orderFn(
            sql`COALESCE(${purchaseOrders.createdOn}, '1970-01-01T00:00:00.000Z'::timestamp)`,
          ),
          orderFn(purchaseOrders.purchaseOrderId),
        );
      },
      encodeRow: (row) => ({
        score: Number(row.score) || 0,
        createdOn: row.createdOn
          ? row.createdOn.toISOString()
          : '1970-01-01T00:00:00.000Z',
        id: row.id,
      }),
    });

    // --- Aggregate line totals per app order ---
    const appTotalMap = new Map<string, string>();
    const appProductQtyMap = new Map<string, string>();
    const appProductReceivedMap = new Map<string, string>();

    const appOrderIds = appRows.map((r) => r.id);
    if (appOrderIds.length > 0) {
      const totals = await this.db
        .select({
          purchaseOrderId: purchaseOrderLineItems.purchaseOrderId,
          total: sql<string>`COALESCE(SUM(${purchaseOrderLineItems.totalAmount}::numeric), 0)::text`,
        })
        .from(purchaseOrderLineItems)
        .where(inArray(purchaseOrderLineItems.purchaseOrderId, appOrderIds))
        .groupBy(purchaseOrderLineItems.purchaseOrderId);

      for (const row of totals) {
        appTotalMap.set(row.purchaseOrderId, row.total);
      }

      if (productId) {
        const productQtys = await this.db
          .select({
            purchaseOrderId: purchaseOrderLineItems.purchaseOrderId,
            qty: sql<string>`COALESCE(SUM(${purchaseOrderLineItems.quantity}::numeric), 0)::text`,
            received: sql<string>`COALESCE(SUM(${purchaseOrderLineItems.quantityReceived}::numeric), 0)::text`,
          })
          .from(purchaseOrderLineItems)
          .where(
            and(
              inArray(purchaseOrderLineItems.purchaseOrderId, appOrderIds),
              eq(purchaseOrderLineItems.productId, productId),
            ),
          )
          .groupBy(purchaseOrderLineItems.purchaseOrderId);

        for (const row of productQtys) {
          appProductQtyMap.set(row.purchaseOrderId, row.qty);
          appProductReceivedMap.set(row.purchaseOrderId, row.received);
        }
      }
    }

    const unified: UnifiedPurchaseOrderRow[] = appRows.map((r) => {
      return {
        id: r.id,
        orderNumber: r.orderNumber ?? '',
        name: r.name ?? '',
        vendorName: r.vendorName ?? '',
        referenceNumber: r.referenceNumber ?? '',
        stateCode: r.stateCode ?? PURCHASE_ORDER_STATE.DRAFT,
        createdBy: r.createdBy ?? '',
        createdOn: r.createdOn ? new Date(r.createdOn).toISOString() : null,
        expectedDate: r.expectedDate
          ? new Date(r.expectedDate).toISOString()
          : null,
        totalPrice: appTotalMap.get(r.id) ?? null,
        currencyCode: r.currencyCode ?? 'EUR',
        productQuantity: productId
          ? (appProductQtyMap.get(r.id) ?? '0')
          : undefined,
        productQuantityReceived: productId
          ? (appProductReceivedMap.get(r.id) ?? '0')
          : undefined,
      };
    });

    return {
      data: unified,
      page,
      limit,
      total: Number(count),
      nextCursor,
      prevCursor,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  async findOne(id: string, tx: any = this.db) {
    const rawOrder = await tx
      .select()
      .from(purchaseOrders)
      .leftJoin(
        coreSuppliers,
        eq(purchaseOrders.vendorId, coreSuppliers.vendorId),
      )
      .leftJoin(actors, eq(coreSuppliers.actorId, actors.actorId))
      .leftJoin(
        locations,
        eq(purchaseOrders.deliveryLocationId, locations.locationId),
      )
      .where(eq(purchaseOrders.purchaseOrderId, id))
      .limit(1)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      .then((res: any[]) => res[0]);

    if (!rawOrder) {
      throw new NotFoundException(`Purchase Order ${id} not found`);
    }

    const poEntity = rawOrder.purchase_orders || rawOrder;
    const vendorName =
      rawOrder.actors?.name || rawOrder.suppliers?.name || poEntity.vendorId;
    const locationName =
      rawOrder.locations?.name || poEntity.deliveryLocationId;

    const order = {
      ...poEntity,
      vendorName,
      locationName,
      customerName: vendorName,
    };

    const rawLines = await tx
      .select()
      .from(purchaseOrderLineItems)
      .leftJoin(
        products,
        eq(purchaseOrderLineItems.productId, products.productId),
      )
      .where(eq(purchaseOrderLineItems.purchaseOrderId, id))
      .orderBy(purchaseOrderLineItems.lineNumber);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    const lines = rawLines.map((r: any) => {
      const lineEntity = r.purchase_order_lines || r;
      return {
        ...lineEntity,
        productNumber: r.products?.productNumber || lineEntity.productId,
        baseUom: r.products?.baseUom,
      };
    });

    const productIds: string[] = Array.from(
      new Set(
        lines
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
          .map((l: any) => l.productId as string | null)
          .filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
            (id: any): id is string =>
              id !== null && id !== '00000000-0000-4000-8000-000000000000',
          ),
      ),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    let allUoms: any[] = [];
    if (productIds.length > 0) {
      allUoms = await tx
        .select()
        .from(productUoms)
        .where(inArray(productUoms.productId, productIds));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    const linesWithUoms = lines.map((line: any) => {
      return {
        ...line,
        productUoms: allUoms.filter((u) => u.productId === line.productId),
      };
    });

    const events = await tx
      .select()
      .from(procurementEvents)
      .where(eq(procurementEvents.entityId, id))
      .orderBy(procurementEvents.createdOn);

    return {
      ...order,
      name: order.name,
      vendorId: order.vendorId,
      currencyCode: order.currencyCode,
      notes: order.notes,
      referenceNumber: order.referenceNumber,
      stateCode: order.stateCode,
      deliveryLocationId: order.deliveryLocationId,
      expectedDate: order.expectedDate,
      salesOrderId: order.purchaseOrderId,
      source: 'app' as const,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      lines: linesWithUoms.map((l: any) => ({
        ...l,
        salesOrderLineId: l.purchaseOrderLineId,
      })),
      events,
    };
  }

  async findPendingLines(productId?: string, vendorId?: string) {
    if (!productId && !vendorId) {
      throw new BadRequestException(
        'Either productId or vendorId is required to find pending lines',
      );
    }

    const conditions = [
      inArray(purchaseOrders.stateCode, [
        PURCHASE_ORDER_STATE.ORDERED,
        PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED,
        PURCHASE_ORDER_STATE.RECEIVED,
      ]),
    ];

    if (productId) {
      conditions.push(eq(purchaseOrderLineItems.productId, productId));
      conditions.push(
        sql`COALESCE(CAST(${purchaseOrderLineItems.quantityReceived} AS NUMERIC), 0) < CAST(${purchaseOrderLineItems.quantity} AS NUMERIC)`,
      );
    }

    if (vendorId) {
      conditions.push(eq(purchaseOrders.vendorId, vendorId));
    }

    const invoicedSubquery = this.db
      .select({
        purchaseOrderLineId: purchaseInvoiceLines.purchaseOrderLineId,
        totalInvoiced:
          sql<string>`COALESCE(SUM(CAST(${purchaseInvoiceLines.quantityInvoiced} AS NUMERIC)), 0)::text`.as(
            'total_invoiced',
          ),
      })
      .from(purchaseInvoiceLines)
      .where(sql`${purchaseInvoiceLines.purchaseOrderLineId} IS NOT NULL`)
      .groupBy(purchaseInvoiceLines.purchaseOrderLineId)
      .as('invoiced_agg');

    return await this.db
      .select({
        purchaseOrderId: purchaseOrders.purchaseOrderId,
        orderNumber: purchaseOrders.orderNumber,
        purchaseOrderName: purchaseOrders.name,
        vendorName: actors.name,
        stateCode: purchaseOrders.stateCode,
        vendorId: purchaseOrders.vendorId,
        deliveryLocationId: purchaseOrders.deliveryLocationId,
        locationName: locations.name,
        currencyCode: purchaseOrders.currencyCode,
        purchaseOrderLineId: purchaseOrderLineItems.purchaseOrderLineId,
        lineNumber: purchaseOrderLineItems.lineNumber,
        productId: purchaseOrderLineItems.productId,
        productNumber: products.productNumber,
        productDescription: purchaseOrderLineItems.productDescription,
        quantity: purchaseOrderLineItems.quantity,
        pricePerUnit: purchaseOrderLineItems.pricePerUnit,
        quantityReceived: purchaseOrderLineItems.quantityReceived,
        quantityInvoiced:
          sql<string>`COALESCE(${invoicedSubquery.totalInvoiced}, '0')`.as(
            'quantity_invoiced',
          ),
      })
      .from(purchaseOrderLineItems)
      .innerJoin(
        purchaseOrders,
        eq(
          purchaseOrderLineItems.purchaseOrderId,
          purchaseOrders.purchaseOrderId,
        ),
      )
      .leftJoin(
        coreSuppliers,
        eq(purchaseOrders.vendorId, coreSuppliers.vendorId),
      )
      .leftJoin(actors, eq(coreSuppliers.actorId, actors.actorId))
      .leftJoin(
        products,
        eq(purchaseOrderLineItems.productId, products.productId),
      )
      .leftJoin(
        invoicedSubquery,
        eq(
          purchaseOrderLineItems.purchaseOrderLineId,
          invoicedSubquery.purchaseOrderLineId,
        ),
      )
      .leftJoin(
        locations,
        eq(purchaseOrders.deliveryLocationId, locations.locationId),
      )
      .where(and(...conditions))
      .orderBy(
        desc(purchaseOrders.createdOn),
        purchaseOrderLineItems.lineNumber,
      );
  }

  async findReturnableLines(productId: string) {
    if (!productId) {
      throw new BadRequestException(
        'productId is required to find returnable lines',
      );
    }

    return await this.db
      .select({
        purchaseOrderId: purchaseOrders.purchaseOrderId,
        orderNumber: purchaseOrders.orderNumber,
        purchaseOrderName: purchaseOrders.name,
        vendorName: actors.name,
        stateCode: purchaseOrders.stateCode,
        vendorId: purchaseOrders.vendorId,
        currencyCode: purchaseOrders.currencyCode,
        purchaseOrderLineId: purchaseOrderLineItems.purchaseOrderLineId,
        lineNumber: purchaseOrderLineItems.lineNumber,
        productDescription: purchaseOrderLineItems.productDescription,
        quantity: purchaseOrderLineItems.quantity,
        pricePerUnit: purchaseOrderLineItems.pricePerUnit,
        quantityReceived: purchaseOrderLineItems.quantityReceived,
      })
      .from(purchaseOrderLineItems)
      .innerJoin(
        purchaseOrders,
        eq(
          purchaseOrderLineItems.purchaseOrderId,
          purchaseOrders.purchaseOrderId,
        ),
      )
      .leftJoin(
        coreSuppliers,
        eq(purchaseOrders.vendorId, coreSuppliers.vendorId),
      )
      .leftJoin(actors, eq(coreSuppliers.actorId, actors.actorId))
      .where(
        and(
          eq(purchaseOrderLineItems.productId, productId),
          inArray(purchaseOrders.stateCode, [
            PURCHASE_ORDER_STATE.RECEIVED,
            PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED,
            PURCHASE_ORDER_STATE.INVOICED,
          ]),
          sql`${purchaseOrderLineItems.quantityReceived} > 0`,
        ),
      );
  }
}

import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrders,
  purchaseOrderLineItems,
  procurementEvents,
  outbox,
  suppliers as coreSuppliers,
  products,
  productUoms,
  locations,
  backorders,
  purchaseInvoices,
  purchaseInvoiceLines,
  taxCategories,
  supplierExpiries,
} from '../drizzle/herobm-core-schema';
import { eq, or, ilike, desc, sql, inArray, and, asc } from 'drizzle-orm';
import { getErrorMessage } from '@herobm/shared';
import { InventoryService } from '../inventory/inventory.service';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../common/pagination';
import { calculateAuditTrail, AuditMode } from '../common/audit';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import {
  PURCHASE_ORDER_STATE,
  PURCHASE_ORDER_TRANSITIONS,
  getValidStates,
  getAllowedTransitions,
  computeLinePriceForStorage,
  PURCHASE_INVOICE_STATE,
  BACKORDER_TRANSITIONS,
  BACKORDER_STATE,
  OPEN_PURCHASE_ORDER_STATES,
} from '@herobm/shared';
import type { PurchaseOrderState } from '@herobm/shared';

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
}

import { SuppliersService } from '../suppliers/suppliers.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { AppConfigService } from '../settings/app-config.service';
import { BackordersService } from '../orders/backorders.service';

import { TaxResolutionEngine } from '../tax/tax-resolution.engine';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly inventoryService: InventoryService,
    private readonly suppliersService: SuppliersService,
    private readonly taxService: TaxCategoriesService,
    private readonly taxResolutionEngine: TaxResolutionEngine,
    private readonly appConfig: AppConfigService,
    @Inject(forwardRef(() => BackordersService))
    private readonly backordersService: BackordersService,
  ) {}

  private readonly logger = new Logger(PurchaseOrdersService.name);

  private async resolveTaxForLine(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    tx: any,
    vendorId: string,
    productId?: string,
    taxCategoryIdOverride?: string,
  ): Promise<{ taxCategoryId: string; rate: number }> {
    const supplier = await this.suppliersService.findOne(vendorId);

    const resolvedTaxCategoryId =
      await this.taxResolutionEngine.resolveTaxCategory(
        {
          isPurchase: true,
          isTaxRegistered: supplier.isTaxRegistered || false,
          partyTaxPositionId:
            supplier.taxPositionId ||
            ((supplier as Record<string, unknown>)
              .supplierGroupTaxPositionId as string | undefined) ||
            null,
          productId:
            productId === '00000000-0000-0000-0000-000000000000'
              ? null
              : productId || null,
          productDefaultTaxCategoryId: null,
          manualOverrideTaxCategoryId: taxCategoryIdOverride || null,
        },
        tx,
      );

    if (resolvedTaxCategoryId) {
      try {
        const catRows = await tx
          .select()
          .from(taxCategories)
          .where(eq(taxCategories.taxCategoryId, resolvedTaxCategoryId))
          .limit(1);
        if (catRows.length > 0) {
          return {
            taxCategoryId: catRows[0].taxCategoryId,
            rate: parseFloat(catRows[0].rate ?? '0'),
          };
        }
      } catch (err) {
        // Ignore and fallback
      }
    }

    const defaultGstRows = await tx
      .select()
      .from(taxCategories)
      .where(eq(taxCategories.isDefault, true))
      .limit(1);
    if (defaultGstRows.length === 0) {
      throw new NotFoundException('No default tax category configured');
    }
    return {
      taxCategoryId: defaultGstRows[0].taxCategoryId,
      rate: parseFloat(defaultGstRows[0].rate ?? '0'),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  async create(createDto: any, userId: string) {
    return await this.db.transaction(async (tx) => {
      if (!createDto.deliveryLocationId) {
        throw new BadRequestException(
          'Delivery location is mandatory for all purchase orders.',
        );
      }

      // Ensure location exists
      const [loc] = await tx
        .select()
        .from(locations)
        .where(eq(locations.locationId, createDto.deliveryLocationId))
        .limit(1);

      if (!loc) {
        throw new BadRequestException('Invalid delivery location ID.');
      }

      // Option B: Just in time lookup against supplierExpiries
      const expiredDocs = await tx
        .select({ id: supplierExpiries.expiryId })
        .from(supplierExpiries)
        .where(
          and(
            eq(supplierExpiries.vendorId, createDto.vendorId),
            sql`${supplierExpiries.expiryDate} < CURRENT_DATE`,
          ),
        )
        .limit(1);

      if (expiredDocs.length > 0) {
        throw new BadRequestException(
          'Supplier has expired compliance documentation. Cannot create purchase order.',
        );
      }

      // Create PO
      let order;
      try {
        const [inserted] = await tx
          .insert(purchaseOrders)
          .values({
            purchaseOrderId: createDto.purchaseOrderId,
            orderNumber: createDto.orderNumber, // In reality, should auto-gen
            name: createDto.name,
            vendorId: createDto.vendorId,
            currencyCode:
              createDto.currencyCode || this.appConfig.homeCurrency(),
            notes: createDto.notes,
            createdBy: userId,
            stateCode: PURCHASE_ORDER_STATE.DRAFT,
            deliveryLocationId: createDto.deliveryLocationId,
            referenceNumber: createDto.referenceNumber,
            expectedDate: createDto.expectedDate
              ? new Date(createDto.expectedDate)
              : null,
          })
          .returning();
        order = inserted;
      } catch (err: unknown) {
        console.error('PO INSERT ERROR:', getErrorMessage(err) || err);
        throw err;
      }

      // Create lines if any
      if (createDto.lines && createDto.lines.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        const lineValues: any[] = [];
        let index = 0;
        for (const line of createDto.lines) {
          const { taxCategoryId, rate } = await this.resolveTaxForLine(
            tx,
            createDto.vendorId,
            line.productId,
            line.taxCategoryId,
          );
          const pricing = computeLinePriceForStorage({
            quantity: parseFloat(line.quantity || '0'),
            pricePerUnit: parseFloat(line.pricePerUnit || '0'),
            discountPercentage: parseFloat(line.discountPercentage || '0'),
            taxRate: rate,
          });

          lineValues.push({
            purchaseOrderId: order.purchaseOrderId,
            lineNumber: index + 1,
            productId: line.productId,
            productDescription: line.productDescription,
            quantity: line.quantity.toString(),
            pricePerUnit: line.pricePerUnit.toString(),
            discountPercentage: line.discountPercentage?.toString() || '0',
            unitOfMeasure: line.unitOfMeasure || 'EA',
            amount: pricing.amount,
            tax: pricing.tax,
            totalAmount: pricing.totalAmount,
            taxCategoryId,
          });
          index++;
        }

        await tx.insert(purchaseOrderLineItems).values(lineValues);
      }

      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: order.purchaseOrderId,
        eventType: EventType.CREATED,
        entityDisplayName: order.orderNumber,
        payload: {
          orderNumber: order.orderNumber,
          vendorId: createDto.vendorId,
          lineCount: createDto.lines?.length || 0,
        },
        actor: userId,
      });

      return this.findOne(order.purchaseOrderId, tx);
    });
  }

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
    } = parsePagination(query);

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${purchaseOrders.orderNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${purchaseOrders.orderNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${purchaseOrders.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${purchaseOrders.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${coreSuppliers.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${coreSuppliers.name} ILIKE ${rawSearchTerm + '%'} THEN 2
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
          ilike(coreSuppliers.name, `%${rawSearchTerm}%`),
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

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseOrders)
      .leftJoin(
        coreSuppliers,
        eq(purchaseOrders.vendorId, coreSuppliers.vendorId),
      )
      .where(whereClause);

    // --- App orders ---
    let appQuery = this.db
      .select({
        id: purchaseOrders.purchaseOrderId,
        orderNumber: purchaseOrders.orderNumber,
        name: purchaseOrders.name,
        vendorName: coreSuppliers.name,
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

    // Support both tuple JOIN structure (drizzle live engine) and flat structure (jest mocks)
    const poEntity = rawOrder.purchase_orders || rawOrder;
    const vendorName = rawOrder.suppliers?.name || poEntity.vendorId;
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
              id !== null && id !== '00000000-0000-0000-0000-000000000000',
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

    // Alias PO-specific fields to sales-order field names so the shared
    // frontend components work without fork. The canonical PO fields are
    // also included so callers that know about POs can use them directly.
    return {
      ...order,
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

  async changePurchaseOrderState(
    id: string,
    stateCode: PurchaseOrderState,
    actor: string = 'system',
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const validStates = getValidStates(PURCHASE_ORDER_TRANSITIONS);
    if (!validStates.includes(stateCode)) {
      throw new BadRequestException(`Invalid state: '${stateCode}'`);
    }

    const existing = await this.findOne(id, db);
    if (!existing) {
      throw new NotFoundException(`Purchase Order ${id} not found`);
    }

    const allowed = getAllowedTransitions(
      PURCHASE_ORDER_TRANSITIONS,
      existing.stateCode,
    );
    if (!allowed.includes(stateCode)) {
      throw new BadRequestException(
        `Cannot transition from '${existing.stateCode}' to '${stateCode}'. ` +
          `Allowed transitions: ${allowed.join(', ') || 'none'}`,
      );
    }

    if (
      existing.stateCode === PURCHASE_ORDER_STATE.DRAFT &&
      stateCode === PURCHASE_ORDER_STATE.ORDERED
    ) {
      if (!existing.deliveryLocationId) {
        throw new BadRequestException(
          'Cannot order: A Delivery Location must be specified.',
        );
      }

      const risk = await this.suppliersService.assessRisk(
        existing.vendorId,
        db,
      );
      if (risk.isPurchasingBlocked) {
        throw new BadRequestException(
          `Cannot order: Supplier purchasing is blocked. Reasons: ${risk.purchasingBlockReasons.join(', ')}`,
        );
      }
    }

    if (stateCode === PURCHASE_ORDER_STATE.CANCELLED) {
      const anyReceived = existing.lines.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        (l: any) => parseFloat(l.quantityReceived || '0') > 0,
      );
      if (anyReceived) {
        throw new BadRequestException(
          'Cannot cancel a Purchase Order that has received goods. Use Close Short instead.',
        );
      }

      const invoiceLines = await db
        .select()
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.purchaseOrderId, id))
        .limit(1);

      if (invoiceLines.length > 0) {
        throw new BadRequestException(
          'Cannot cancel a Purchase Order that has attached invoices.',
        );
      }
    }

    if (stateCode === PURCHASE_ORDER_STATE.CLOSED_SHORT) {
      for (const line of existing.lines) {
        const received = parseFloat(line.quantityReceived || '0');
        if (received > 0) {
          const [{ totalInvoiced }] = await db
            .select({
              totalInvoiced:
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
                sql<string>`COALESCE(SUM(CAST(${purchaseInvoiceLines.quantityInvoiced} AS NUMERIC)), 0)::text` as any,
            })
            .from(purchaseInvoiceLines)
            .innerJoin(
              purchaseInvoices,
              eq(purchaseInvoiceLines.invoiceId, purchaseInvoices.invoiceId),
            )
            .where(
              and(
                eq(
                  purchaseInvoiceLines.purchaseOrderLineId,
                  line.purchaseOrderLineId,
                ),
                eq(purchaseInvoices.stateCode, PURCHASE_INVOICE_STATE.INVOICED),
              ),
            );
          const invoiced = parseFloat(totalInvoiced || '0');
          if (received > invoiced + 0.001) {
            throw new BadRequestException(
              `Cannot close short: Received quantities for product ${line.productNumber} must be fully invoiced first. Received: ${received}, Invoiced: ${invoiced}`,
            );
          }
        }
      }
    }

    return await db.transaction(async (tx: DrizzleDB) => {
      const updated = await this.updateStateInternal(id, stateCode, actor, tx);

      if (
        stateCode === PURCHASE_ORDER_STATE.CANCELLED ||
        stateCode === PURCHASE_ORDER_STATE.CLOSED_SHORT
      ) {
        const affected = await tx
          .select({ id: backorders.backorderId, soId: backorders.salesOrderId })
          .from(backorders)
          .where(eq(backorders.purchaseOrderId, id));
        for (const b of affected) {
          await this.backordersService.changeBackorderState(
            b.id,
            BACKORDER_STATE.PENDING_SUPPLY,
            actor,
            tx,
          );

          await emitEvent(tx, {
            entityType: EntityType.SALES_ORDER,
            entityId: b.soId,
            eventType: EventType.DEMAND_UNALLOCATED,
            entityDisplayName: `Sales Order`,
            payload: { backorderId: b.id },
            actor,
          });
        }

        await tx
          .update(backorders)
          .set({
            purchaseOrderId: null,
            purchaseOrderLineId: null,
            modifiedOn: new Date(),
          })
          .where(eq(backorders.purchaseOrderId, id));
      }

      return updated;
    });
  }

  /**
   * Archive a purchase order.
   */
  async archive(id: string, actor: string) {
    const existing = await this.findOne(id);

    if (
      existing.stateCode !== PURCHASE_ORDER_STATE.RECEIVED &&
      existing.stateCode !== PURCHASE_ORDER_STATE.CANCELLED
    ) {
      throw new BadRequestException(
        `Purchase Order must be 'received' or 'cancelled' to be archived (current state: '${existing.stateCode}')`,
      );
    }

    return await this.changePurchaseOrderState(
      id,
      PURCHASE_ORDER_STATE.ARCHIVED,
      actor,
    );
  }

  /**
   * Unarchive a purchase order.
   */
  async unarchive(id: string, actor: string) {
    const existing = await this.findOne(id);

    if (existing.stateCode !== PURCHASE_ORDER_STATE.ARCHIVED) {
      throw new BadRequestException(`Purchase Order is not archived`);
    }

    // Default to cancelled since no event store exists for POs yet
    return await this.changePurchaseOrderState(
      id,
      PURCHASE_ORDER_STATE.CANCELLED,
      actor,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  async addLine(orderId: string, lineDto: any, actor: string = 'system') {
    return await this.db.transaction(async (tx) => {
      // Lock the order to prevent concurrent addLine races
      await tx
        .select({ id: purchaseOrders.purchaseOrderId })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.purchaseOrderId, orderId))
        .for('update');

      const existing = await this.findOne(orderId, tx);
      if (existing.stateCode !== PURCHASE_ORDER_STATE.DRAFT) {
        throw new BadRequestException(
          'Can only add lines to draft purchase orders',
        );
      }

      const maxLine = existing.lines.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        (max: number, l: any) => Math.max(max, l.lineNumber || 0),
        0,
      );

      const qty = parseFloat(lineDto.quantity || '1');
      const price = parseFloat(lineDto.pricePerUnit || '0');
      const disc = parseFloat(lineDto.discountPercentage || '0');
      const { taxCategoryId, rate } = await this.resolveTaxForLine(
        tx,
        existing.vendorId,
        lineDto.productId,
        lineDto.taxCategoryId,
      );
      const pricing = computeLinePriceForStorage({
        quantity: qty,
        pricePerUnit: price,
        discountPercentage: disc,
        taxRate: rate,
      });

      await tx.insert(purchaseOrderLineItems).values({
        purchaseOrderId: orderId,
        lineNumber: maxLine + 1,
        productId: lineDto.productId,
        productDescription: lineDto.productDescription,
        quantity: lineDto.quantity?.toString() || '1',
        pricePerUnit: lineDto.pricePerUnit?.toString() || '0',
        discountPercentage: lineDto.discountPercentage?.toString() || '0',
        unitOfMeasure: lineDto.unitOfMeasure || 'EA',
        amount: pricing.amount,
        tax: pricing.tax,
        totalAmount: pricing.totalAmount,
        taxCategoryId,
      });

      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: orderId,
        eventType: EventType.LINE_ADDED,
        entityDisplayName: existing.orderNumber,
        payload: {
          productId: lineDto.productId,
          quantity: lineDto.quantity,
          pricePerUnit: lineDto.pricePerUnit,
        },
        actor,
      });

      return this.findOne(orderId, tx);
    });
  }

  async updateLine(
    orderId: string,
    lineId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    lineDto: any,
    actor: string = 'system',
  ) {
    return await this.db.transaction(async (tx) => {
      const existing = await this.findOne(orderId, tx);
      if (existing.stateCode !== PURCHASE_ORDER_STATE.DRAFT) {
        throw new BadRequestException(
          'Can only update lines on draft purchase orders',
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      const updateFields: any = {};
      if (lineDto.quantity !== undefined)
        updateFields.quantity = lineDto.quantity.toString();
      if (lineDto.pricePerUnit !== undefined)
        updateFields.pricePerUnit = lineDto.pricePerUnit.toString();
      if (lineDto.discountPercentage !== undefined)
        updateFields.discountPercentage = lineDto.discountPercentage.toString();
      if (lineDto.productDescription !== undefined)
        updateFields.productDescription = lineDto.productDescription;
      if (lineDto.unitOfMeasure !== undefined)
        updateFields.unitOfMeasure = lineDto.unitOfMeasure;
      if (lineDto.taxCategoryId !== undefined)
        updateFields.taxCategoryId = lineDto.taxCategoryId;

      // Recalculate amount if qty, price, discount, or tax changed
      if (
        lineDto.quantity !== undefined ||
        lineDto.pricePerUnit !== undefined ||
        lineDto.discountPercentage !== undefined ||
        lineDto.taxCategoryId !== undefined
      ) {
        const line = existing.lines.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
          (l: any) => l.purchaseOrderLineId === lineId,
        );
        const qty = parseFloat(
          lineDto.quantity?.toString() || line?.quantity || '0',
        );
        const price = parseFloat(
          lineDto.pricePerUnit?.toString() || line?.pricePerUnit || '0',
        );
        const disc = parseFloat(
          lineDto.discountPercentage?.toString() ||
            line?.discountPercentage ||
            '0',
        );

        let targetGst = line.taxCategoryId;
        if (lineDto.taxCategoryId !== undefined) {
          targetGst = lineDto.taxCategoryId;
        }

        const resolved = await this.resolveTaxForLine(
          tx,
          existing.vendorId,
          line.productId,
          targetGst,
        );
        updateFields.taxCategoryId = resolved.taxCategoryId;

        const pricing = computeLinePriceForStorage({
          quantity: qty,
          pricePerUnit: price,
          discountPercentage: disc,
          taxRate: resolved.rate,
        });
        updateFields.amount = pricing.amount;
        updateFields.tax = pricing.tax;
        updateFields.totalAmount = pricing.totalAmount;
      }

      await tx
        .update(purchaseOrderLineItems)
        .set(updateFields)
        .where(eq(purchaseOrderLineItems.purchaseOrderLineId, lineId));

      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: orderId,
        eventType: EventType.LINE_UPDATED,
        entityDisplayName: existing.orderNumber,
        payload: {
          lineId,
          changes: updateFields,
        },
        actor,
      });

      return this.findOne(orderId, tx);
    });
  }

  async removeLine(orderId: string, lineId: string, actor: string = 'system') {
    return await this.db.transaction(async (tx) => {
      const existing = await this.findOne(orderId, tx);
      if (existing.stateCode !== PURCHASE_ORDER_STATE.DRAFT) {
        throw new BadRequestException(
          'Can only remove lines from draft purchase orders',
        );
      }

      // Reset associated demand records so they reappear as open demand
      await tx
        .update(backorders)
        .set({
          purchaseOrderId: null,
          purchaseOrderLineId: null,
          // eslint-disable-next-line no-restricted-syntax -- External API integration boundaries where exact types are unknown.
          stateCode: BACKORDER_STATE.PENDING_SUPPLY,
        })
        .where(eq(backorders.purchaseOrderLineId, lineId));

      await tx
        .delete(purchaseOrderLineItems)
        .where(eq(purchaseOrderLineItems.purchaseOrderLineId, lineId));

      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: orderId,
        eventType: EventType.LINE_REMOVED,
        entityDisplayName: existing.orderNumber,
        payload: { lineId },
        actor,
      });

      return this.findOne(orderId, tx);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  async update(id: string, updateDto: any, userId: string) {
    return await this.db.transaction(async (tx) => {
      const existing = await this.findOne(id, tx);
      if (
        existing.stateCode !== PURCHASE_ORDER_STATE.DRAFT &&
        existing.stateCode !== PURCHASE_ORDER_STATE.ORDERED &&
        existing.stateCode !== PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED
      ) {
        throw new BadRequestException(
          `Cannot update purchase orders in state ${existing.stateCode}`,
        );
      }

      if (
        existing.stateCode !== PURCHASE_ORDER_STATE.DRAFT &&
        updateDto.lines
      ) {
        throw new BadRequestException(
          'Cannot update lines on non-draft purchase orders',
        );
      }

      const [updated] = await tx
        .update(purchaseOrders)
        .set({
          name: updateDto.name,
          vendorId: updateDto.vendorId,
          currencyCode: updateDto.currencyCode,
          notes: updateDto.notes,
          // eslint-disable-next-line no-restricted-syntax -- External API integration boundaries where exact types are unknown.
          stateCode: updateDto.stateCode, // allow transition to 'ordered'
          deliveryLocationId: updateDto.deliveryLocationId,
          referenceNumber: updateDto.referenceNumber,
          expectedDate: updateDto.expectedDate
            ? new Date(updateDto.expectedDate)
            : null,
          modifiedOn: new Date(),
        })
        .where(eq(purchaseOrders.purchaseOrderId, id))
        .returning();

      // For simplicity in this demo, we're not doing full line-item syncing
      // Usually you'd use a delta technique or delete/recreate.
      // If updating lines, delete and recreate for simplicity.
      if (updateDto.lines) {
        await tx
          .delete(purchaseOrderLineItems)
          .where(eq(purchaseOrderLineItems.purchaseOrderId, id));

        if (updateDto.lines.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
          const lineValues: any[] = [];
          let index = 0;
          for (const line of updateDto.lines) {
            const qty = parseFloat(line.quantity || '0');
            const price = parseFloat(line.pricePerUnit || '0');
            const disc = parseFloat(line.discountPercentage || '0');
            const { taxCategoryId, rate } = await this.resolveTaxForLine(
              tx,
              existing.vendorId,
              line.productId,
              line.taxCategoryId,
            );
            const pricing = computeLinePriceForStorage({
              quantity: qty,
              pricePerUnit: price,
              discountPercentage: disc,
              taxRate: rate,
            });
            lineValues.push({
              purchaseOrderId: id,
              lineNumber: index + 1,
              productId: line.productId,
              productDescription: line.productDescription,
              quantity: line.quantity.toString(),
              pricePerUnit: line.pricePerUnit.toString(),
              unitOfMeasure: line.unitOfMeasure || 'EA',
              amount: pricing.amount,
              tax: pricing.tax,
              totalAmount: pricing.totalAmount,
              taxCategoryId,
            });
            index++;
          }
          await tx.insert(purchaseOrderLineItems).values(lineValues);
        }

        const audit = calculateAuditTrail(updateDto, existing, AuditMode.DIFF);
        if (audit.hasChanges) {
          await emitEvent(tx as unknown as DrizzleDB, {
            entityType: EntityType.PURCHASE_ORDER,
            entityId: id,
            eventType: EventType.UPDATED,
            entityDisplayName: existing.orderNumber,
            payload: {
              changes: audit.changes,
              previousValues: audit.previousValues,
              linesCount: updateDto.lines?.length,
            },
            actor: userId,
          });
        }
      }

      return this.findOne(id, tx);
    });
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
        PURCHASE_ORDER_STATE.LEGACY,
      ]),
    ];

    // When filtering by productId (used from returns/other flows),
    // keep the quantity filter to only show lines still pending receipt.
    if (productId) {
      conditions.push(eq(purchaseOrderLineItems.productId, productId));
      conditions.push(
        sql`COALESCE(CAST(${purchaseOrderLineItems.quantityReceived} AS NUMERIC), 0) < CAST(${purchaseOrderLineItems.quantity} AS NUMERIC)`,
      );
    }

    if (vendorId) {
      conditions.push(eq(purchaseOrders.vendorId, vendorId));
    }

    // Subquery: total quantity already invoiced for each PO line
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
        vendorName: coreSuppliers.name,
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
        vendorName: coreSuppliers.name,
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

  private async updateStateInternal(
    purchaseOrderId: string,
    newState: string,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const VALID_STATES = getValidStates(PURCHASE_ORDER_TRANSITIONS);
    if (!VALID_STATES.includes(newState)) {
      throw new BadRequestException(`Invalid PO state: '${newState}'`);
    }

    const db = tx || this.db;
    const [existing] = await db
      .select({
        stateCode: purchaseOrders.stateCode,
        orderNumber: purchaseOrders.orderNumber,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, purchaseOrderId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(
        `Purchase Order ${purchaseOrderId} not found`,
      );
    }

    const allowed = PURCHASE_ORDER_TRANSITIONS[existing.stateCode];
    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition PO from '${existing.stateCode}' to '${newState}'. Allowed transitions: ${allowed?.join(', ') || 'none'}`,
      );
    }

    const [updated] = await db
      .update(purchaseOrders)
      .set({
        // eslint-disable-next-line no-restricted-syntax, @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        stateCode: newState as any,
        modifiedOn: new Date(),
      })
      .where(eq(purchaseOrders.purchaseOrderId, purchaseOrderId))
      .returning();

    const eventPayload = {
      entity: 'purchase_order',
      entityId: purchaseOrderId,
      orderNumber: existing.orderNumber,
      from: existing.stateCode,
      to: newState,
    };

    if (newState === PURCHASE_ORDER_STATE.ARCHIVED) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      await emitEvent(db as any, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: purchaseOrderId,
        eventType: EventType.ARCHIVED,
        entityDisplayName: existing.orderNumber,
        payload: eventPayload,
        actor,
      });
    } else if (existing.stateCode === PURCHASE_ORDER_STATE.ARCHIVED) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      await emitEvent(db as any, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: purchaseOrderId,
        eventType: EventType.UNARCHIVED,
        entityDisplayName: existing.orderNumber,
        payload: eventPayload,
        actor,
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      await emitEvent(db as any, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: purchaseOrderId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: existing.orderNumber,
        payload: eventPayload,
        actor,
      });
    }

    return updated;
  }
}

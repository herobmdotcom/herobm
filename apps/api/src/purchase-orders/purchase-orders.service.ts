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
  purchaseOrderEvents,
  outbox,
  suppliers as coreSuppliers,
  products,
  productUoms,
  locations,
  backorders,
  purchaseInvoices,
  purchaseInvoiceLines,
  taxCategories,
} from '../drizzle/modbm-core-schema';
import { eq, or, ilike, desc, sql, inArray, and, asc } from 'drizzle-orm';
import { InventoryService } from '../inventory/inventory.service';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../common/pagination';
import { calculateAuditTrail, AuditMode } from '../common/audit';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
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
} from '@modbm/shared';
import type { PurchaseOrderState } from '@modbm/shared';

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

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly inventoryService: InventoryService,
    private readonly suppliersService: SuppliersService,
    private readonly taxService: TaxCategoriesService,
    private readonly appConfig: AppConfigService,
    @Inject(forwardRef(() => BackordersService))
    private readonly backordersService: BackordersService,
  ) {}

  private readonly logger = new Logger(PurchaseOrdersService.name);

  private async resolveTaxForLine(
    tx: any,
    productId?: string,
    taxCategoryIdOverride?: string,
  ): Promise<{ taxCategoryId: string; rate: number }> {
    if (taxCategoryIdOverride) {
      try {
        const catRows = await tx
          .select()
          .from(taxCategories)
          .where(eq(taxCategories.taxCategoryId, taxCategoryIdOverride))
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

    if (productId && productId !== '00000000-0000-0000-0000-000000000000') {
      const pRows = await tx
        .select({ taxCategoryId: products.purchaseTaxCategoryId })
        .from(products)
        .where(eq(products.productId, productId))
        .limit(1);

      if (pRows.length > 0 && pRows[0].taxCategoryId) {
        try {
          const catRows = await tx
            .select()
            .from(taxCategories)
            .where(eq(taxCategories.taxCategoryId, pRows[0].taxCategoryId))
            .limit(1);
          if (catRows.length > 0) {
            return {
              taxCategoryId: catRows[0].taxCategoryId,
              rate: parseFloat(catRows[0].rate ?? '0'),
            };
          }
        } catch (err) {
          this.logger.warn(
            `Product ${productId} had invalid tax category ID: ${pRows[0].taxCategoryId}`,
          );
        }
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
          })
          .returning();
        order = inserted;
      } catch (err: any) {
        console.error('PO INSERT ERROR:', err.message || err);
        throw err;
      }

      // Create lines if any
      if (createDto.lines && createDto.lines.length > 0) {
        const lineValues: any[] = [];
        let index = 0;
        for (const line of createDto.lines) {
          const { taxCategoryId, rate } = await this.resolveTaxForLine(
            tx,
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
        aggregateType: AggregateType.PURCHASE_ORDER,
        aggregateId: order.purchaseOrderId,
        eventType: EventType.CREATED,
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

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(purchaseOrders.orderNumber, searchTerm),
          ilike(purchaseOrders.name, searchTerm),
          ilike(coreSuppliers.name, searchTerm),
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
        conditions.push(eq(purchaseOrders.stateCode, states[0] as any));
      } else {
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
        currencyCode: purchaseOrders.currencyCode,
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
      cursorObj: cursor,
      direction: direction,
      applyWhere: (q, c: { createdOn: string; id: string }, dir) => {
        const cDate = c.createdOn;
        const cursorCond =
          dir === 'next'
            ? or(
                sql`COALESCE(${purchaseOrders.createdOn}, '1970-01-01T00:00:00.000Z'::timestamp) < ${cDate}::timestamp`,
                and(
                  sql`COALESCE(${purchaseOrders.createdOn}, '1970-01-01T00:00:00.000Z'::timestamp) = ${cDate}::timestamp`,
                  sql`${purchaseOrders.purchaseOrderId} < ${c.id}`,
                ),
              )
            : or(
                sql`COALESCE(${purchaseOrders.createdOn}, '1970-01-01T00:00:00.000Z'::timestamp) > ${cDate}::timestamp`,
                and(
                  sql`COALESCE(${purchaseOrders.createdOn}, '1970-01-01T00:00:00.000Z'::timestamp) = ${cDate}::timestamp`,
                  sql`${purchaseOrders.purchaseOrderId} > ${c.id}`,
                ),
              );
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? desc : asc;
        return q.orderBy(
          orderFn(
            sql`COALESCE(${purchaseOrders.createdOn}, '1970-01-01T00:00:00.000Z'::timestamp)`,
          ),
          orderFn(purchaseOrders.purchaseOrderId),
        );
      },
      encodeRow: (row) => ({
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
          .map((l: any) => l.productId as string | null)
          .filter(
            (id: any): id is string =>
              id !== null && id !== '00000000-0000-0000-0000-000000000000',
          ),
      ),
    );

    let allUoms: any[] = [];
    if (productIds.length > 0) {
      allUoms = await tx
        .select()
        .from(productUoms)
        .where(inArray(productUoms.productId, productIds));
    }

    const linesWithUoms = lines.map((line: any) => {
      return {
        ...line,
        productUoms: allUoms.filter((u) => u.productId === line.productId),
      };
    });

    const events = await tx
      .select()
      .from(purchaseOrderEvents)
      .where(eq(purchaseOrderEvents.purchaseOrderId, id))
      .orderBy(purchaseOrderEvents.createdOn);

    // Alias PO-specific fields to sales-order field names so the shared
    // frontend components work without fork. The canonical PO fields are
    // also included so callers that know about POs can use them directly.
    return {
      ...order,
      salesOrderId: order.purchaseOrderId,
      source: 'app' as const,
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

    const existing = await this.findOne(id);
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

      const vendor = await this.suppliersService.findOne(existing.vendorId);
      if (vendor.isPurchasingBlocked || vendor.groupIsPurchasingBlocked) {
        throw new BadRequestException(
          'Cannot order: Supplier or Supplier Group is blocked for purchasing.',
        );
      }
    }

    if (stateCode === PURCHASE_ORDER_STATE.CANCELLED) {
      const anyReceived = existing.lines.some(
        (l: any) => parseFloat(l.quantityReceived || '0') > 0,
      );
      if (anyReceived) {
        throw new BadRequestException(
          'Cannot cancel a Purchase Order that has received goods. Use Close Short instead.',
        );
      }

      const invoiceLines = await this.db
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
          const [{ totalInvoiced }] = await this.db
            .select({
              totalInvoiced:
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
          .select({ id: backorders.backorderId })
          .from(backorders)
          .where(eq(backorders.purchaseOrderId, id));
        for (const b of affected) {
          await this.backordersService.changeBackorderState(
            b.id,
            BACKORDER_STATE.PENDING_SUPPLY,
            actor,
            tx,
          );
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

  async addLine(orderId: string, lineDto: any, actor: string = 'system') {
    return await this.db.transaction(async (tx) => {
      const existing = await this.findOne(orderId, tx);
      if (existing.stateCode !== PURCHASE_ORDER_STATE.DRAFT) {
        throw new BadRequestException(
          'Can only add lines to draft purchase orders',
        );
      }

      const maxLine = existing.lines.reduce(
        (max: number, l: any) => Math.max(max, l.lineNumber || 0),
        0,
      );

      const qty = parseFloat(lineDto.quantity || '1');
      const price = parseFloat(lineDto.pricePerUnit || '0');
      const disc = parseFloat(lineDto.discountPercentage || '0');
      const { taxCategoryId, rate } = await this.resolveTaxForLine(
        tx,
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
        aggregateType: AggregateType.PURCHASE_ORDER,
        aggregateId: orderId,
        eventType: EventType.LINE_ADDED,
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
        aggregateType: AggregateType.PURCHASE_ORDER,
        aggregateId: orderId,
        eventType: EventType.LINE_UPDATED,
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
          // eslint-disable-next-line no-restricted-syntax
          stateCode: BACKORDER_STATE.PENDING_SUPPLY,
        })
        .where(eq(backorders.purchaseOrderLineId, lineId));

      await tx
        .delete(purchaseOrderLineItems)
        .where(eq(purchaseOrderLineItems.purchaseOrderLineId, lineId));

      await emitEvent(tx, {
        aggregateType: AggregateType.PURCHASE_ORDER,
        aggregateId: orderId,
        eventType: EventType.LINE_REMOVED,
        payload: { lineId },
        actor,
      });

      return this.findOne(orderId, tx);
    });
  }

  async update(id: string, updateDto: any, userId: string) {
    return await this.db.transaction(async (tx) => {
      const existing = await this.findOne(id, tx);
      if (existing.stateCode !== PURCHASE_ORDER_STATE.DRAFT) {
        throw new BadRequestException('Can only update draft purchase orders');
      }

      const [updated] = await tx
        .update(purchaseOrders)
        .set({
          name: updateDto.name,
          vendorId: updateDto.vendorId,
          currencyCode: updateDto.currencyCode,
          notes: updateDto.notes,
          // eslint-disable-next-line no-restricted-syntax
          stateCode: updateDto.stateCode, // allow transition to 'ordered'
          deliveryLocationId: updateDto.deliveryLocationId,
          referenceNumber: updateDto.referenceNumber,
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
          const lineValues: any[] = [];
          let index = 0;
          for (const line of updateDto.lines) {
            const qty = parseFloat(line.quantity || '0');
            const price = parseFloat(line.pricePerUnit || '0');
            const disc = parseFloat(line.discountPercentage || '0');
            const { taxCategoryId, rate } = await this.resolveTaxForLine(
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
          await emitEvent(tx, {
            aggregateType: AggregateType.PURCHASE_ORDER,
            aggregateId: id,
            eventType: EventType.UPDATED,
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
        // eslint-disable-next-line no-restricted-syntax
        stateCode: newState as any,
        modifiedOn: new Date(),
      })
      .where(eq(purchaseOrders.purchaseOrderId, purchaseOrderId))
      .returning();

    await emitEvent(db as any, {
      aggregateType: AggregateType.PURCHASE_ORDER,
      aggregateId: purchaseOrderId,
      eventType: EventType.STATUS_CHANGED,
      payload: {
        entity: 'purchase_order',
        entityId: purchaseOrderId,
        orderNumber: existing.orderNumber,
        from: existing.stateCode,
        to: newState,
      },
      actor,
    });

    return updated;
  }
}

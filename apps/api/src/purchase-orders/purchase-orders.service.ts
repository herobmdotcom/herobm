import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
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
} from '../drizzle/modbm-core-schema';
import { eq, or, ilike, desc, sql, inArray, and } from 'drizzle-orm';
import { InventoryService } from '../inventory/inventory.service';
import { PaginationQuery, parsePagination } from '../common/pagination';
import { calculateAuditTrail, AuditMode } from '../common/audit';
import { emitEvent } from '../common/emit-event';
import { AggregateType } from '../common/event-types';
import {
  PURCHASE_ORDER_TRANSITIONS,
  getValidStates,
  getAllowedTransitions,
  computeLinePriceForStorage,
  HOME_CURRENCY,
} from '@modbm/shared';

export interface UnifiedPurchaseOrderRow {
  id: string;
  orderNumber: string;
  name: string;
  vendorName: string;
  invoiceNumber: string;
  stateCode: string;

  createdBy: string;
  createdOn: string | null;
  totalPrice: string | null;
  currencyCode: string | null;
}

import { SuppliersService } from '../suppliers/suppliers.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly inventoryService: InventoryService,
    private readonly suppliersService: SuppliersService,
    private readonly taxService: TaxCategoriesService,
  ) {}

  private readonly logger = new Logger(PurchaseOrdersService.name);

  private async resolveTaxForLine(
    productId?: string,
    taxCategoryIdOverride?: string,
  ): Promise<{ taxCategoryId: string; rate: number }> {
    if (taxCategoryIdOverride) {
      try {
        const cat = await this.taxService.getById(taxCategoryIdOverride);
        return {
          taxCategoryId: cat.taxCategoryId,
          rate: parseFloat(cat.rate ?? '0'),
        };
      } catch (err) {
        // Ignore and fallback
      }
    }

    if (productId && productId !== '00000000-0000-0000-0000-000000000000') {
      const pRows = await this.db
        .select({ taxCategoryId: products.purchaseTaxCategoryId })
        .from(products)
        .where(eq(products.productId, productId))
        .limit(1);

      if (pRows.length > 0 && pRows[0].taxCategoryId) {
        try {
          const cat = await this.taxService.getById(pRows[0].taxCategoryId);
          return {
            taxCategoryId: cat.taxCategoryId,
            rate: parseFloat(cat.rate ?? '0'),
          };
        } catch (err) {
          this.logger.warn(
            `Product ${productId} had invalid tax category ID: ${pRows[0].taxCategoryId}`,
          );
        }
      }
    }

    const defaultGst = await this.taxService.getDefault();
    return {
      taxCategoryId: defaultGst.taxCategoryId,
      rate: parseFloat(defaultGst.rate ?? '0'),
    };
  }

  async create(createDto: any, userId: string) {
    return await this.db.transaction(async (tx) => {
      // Create PO
      let order;
      try {
        const [inserted] = await tx
          .insert(purchaseOrders)
          .values({
            orderNumber: createDto.orderNumber, // In reality, should auto-gen
            name: createDto.name,
            vendorId: createDto.vendorId,
            currencyCode: createDto.currencyCode || HOME_CURRENCY.code,
            notes: createDto.notes,
            createdBy: userId,
            stateCode: 'draft',
            deliveryLocationId: createDto.deliveryLocationId,
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
        eventType: 'created',
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
    const { page, limit, offset, searchTerm, includeArchived, days } =
      parsePagination(query);
    const stateFilter = query?.state ?? null;

    // --- App orders ---
    let appQuery = this.db
      .select({
        id: purchaseOrders.purchaseOrderId,
        orderNumber: purchaseOrders.orderNumber,
        name: purchaseOrders.name,
        vendorName: coreSuppliers.name,
        invoiceNumber: purchaseOrders.invoiceNumber,
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
      .orderBy(desc(purchaseOrders.createdOn))
      .$dynamic();

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
      conditions.push(sql`${purchaseOrders.stateCode} != 'archived'`);
    }

    if (days && days > 0) {
      conditions.push(
        sql`${purchaseOrders.createdOn} >= NOW() - INTERVAL '1 day' * ${days}`,
      );
    }

    if (conditions.length > 0) {
      appQuery = appQuery.where(and(...conditions));
    }

    const appRows = await appQuery;

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
        invoiceNumber: r.invoiceNumber ?? '',
        stateCode: r.stateCode ?? 'draft',
        createdBy: r.createdBy ?? '',
        createdOn: r.createdOn ? new Date(r.createdOn).toISOString() : null,
        totalPrice: appTotalMap.get(r.id) ?? null,
        currencyCode: r.currencyCode ?? 'EUR',
      };
    });

    const paginated = unified.slice(offset, offset + limit);

    return { data: paginated, page, limit, total: unified.length };
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

  async changeState(id: string, stateCode: string, actor: string = 'system') {
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

    if (existing.stateCode === 'draft' && stateCode === 'ordered') {
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

    return await this.db.transaction(async (tx: DrizzleDB) => {
      await tx
        .update(purchaseOrders)
        .set({ stateCode, modifiedOn: new Date() })
        .where(eq(purchaseOrders.purchaseOrderId, id));

      if (stateCode === 'cancelled') {
        await tx
          .update(backorders)
          .set({
            purchaseOrderId: null,
            purchaseOrderLineId: null,
            stateCode: 'pending_supply',
          })
          .where(eq(backorders.purchaseOrderId, id));
      }

      await emitEvent(tx, {
        aggregateType: AggregateType.PURCHASE_ORDER,
        aggregateId: id,
        eventType: 'status_changed',
        payload: {
          from: existing.stateCode,
          to: stateCode,
        },
        actor,
      });

      return this.findOne(id, tx);
    });
  }

  /**
   * Archive a purchase order.
   */
  async archive(id: string, actor: string) {
    const existing = await this.findOne(id);

    if (
      existing.stateCode !== 'received' &&
      existing.stateCode !== 'cancelled'
    ) {
      throw new BadRequestException(
        `Purchase Order must be 'received' or 'cancelled' to be archived (current state: '${existing.stateCode}')`,
      );
    }

    return await this.db.transaction(async (tx: DrizzleDB) => {
      const [updated] = await tx
        .update(purchaseOrders)
        .set({ stateCode: 'archived', modifiedOn: new Date() })
        .where(eq(purchaseOrders.purchaseOrderId, id))
        .returning();

      await emitEvent(tx, {
        aggregateType: AggregateType.PURCHASE_ORDER,
        aggregateId: id,
        eventType: 'archived',
        payload: {
          from: existing.stateCode,
          to: 'archived',
        },
        actor,
      });

      return updated;
    });
  }

  /**
   * Unarchive a purchase order.
   */
  async unarchive(id: string, actor: string) {
    const existing = await this.findOne(id);

    if (existing.stateCode !== 'archived') {
      throw new BadRequestException(`Purchase Order is not archived`);
    }

    // Default to cancelled since no event store exists for POs yet
    return await this.db.transaction(async (tx: DrizzleDB) => {
      const [updated] = await tx
        .update(purchaseOrders)
        .set({ stateCode: 'cancelled', modifiedOn: new Date() })
        .where(eq(purchaseOrders.purchaseOrderId, id))
        .returning();

      await emitEvent(tx, {
        aggregateType: AggregateType.PURCHASE_ORDER,
        aggregateId: id,
        eventType: 'unarchived',
        payload: {
          from: 'archived',
          to: 'cancelled',
        },
        actor,
      });

      return updated;
    });
  }

  async addLine(orderId: string, lineDto: any, actor: string = 'system') {
    return await this.db.transaction(async (tx) => {
      const existing = await this.findOne(orderId, tx);
      if (existing.stateCode !== 'draft') {
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
        eventType: 'line_added',
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
      if (existing.stateCode !== 'draft') {
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
        eventType: 'line_updated',
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
      if (existing.stateCode !== 'draft') {
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
          stateCode: 'pending_supply',
        })
        .where(eq(backorders.purchaseOrderLineId, lineId));

      await tx
        .delete(purchaseOrderLineItems)
        .where(eq(purchaseOrderLineItems.purchaseOrderLineId, lineId));

      await emitEvent(tx, {
        aggregateType: AggregateType.PURCHASE_ORDER,
        aggregateId: orderId,
        eventType: 'line_removed',
        payload: { lineId },
        actor,
      });

      return this.findOne(orderId, tx);
    });
  }

  async update(id: string, updateDto: any, userId: string) {
    return await this.db.transaction(async (tx) => {
      const existing = await this.findOne(id, tx);
      if (existing.stateCode !== 'draft') {
        throw new BadRequestException('Can only update draft purchase orders');
      }

      const [updated] = await tx
        .update(purchaseOrders)
        .set({
          name: updateDto.name,
          vendorId: updateDto.vendorId,
          currencyCode: updateDto.currencyCode,
          notes: updateDto.notes,
          stateCode: updateDto.stateCode, // allow transition to 'ordered'
          deliveryLocationId: updateDto.deliveryLocationId,
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
            eventType: 'updated',
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

  async findPendingLines(productId: string, vendorId?: string) {
    if (!productId) {
      throw new BadRequestException(
        'productId is required to find pending lines',
      );
    }

    const conditions = [
      eq(purchaseOrderLineItems.productId, productId),
      inArray(purchaseOrders.stateCode, [
        'ordered',
        'partially_received',
        'legacy',
      ]),
      sql`COALESCE(CAST(${purchaseOrderLineItems.quantityReceived} AS NUMERIC), 0) < CAST(${purchaseOrderLineItems.quantity} AS NUMERIC)`,
    ];

    if (vendorId) {
      conditions.push(eq(purchaseOrders.vendorId, vendorId));
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
      .where(and(...conditions));
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
            'received',
            'partially_received',
            'invoiced',
          ]),
          sql`${purchaseOrderLineItems.quantityReceived} > 0`,
        ),
      );
  }
}

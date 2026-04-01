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
} from '../drizzle/modbm-core-schema';
import { eq, or, ilike, desc, sql, inArray, and } from 'drizzle-orm';
import { InventoryService } from '../inventory/inventory.service';
import { PaginationQuery, parsePagination } from '../common/pagination';
import { calculateAuditTrail, AuditMode } from '../common/audit';
import {
  PURCHASE_ORDER_TRANSITIONS,
  getValidStates,
  getAllowedTransitions,
  computeLinePriceForStorage,
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

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly inventoryService: InventoryService,
  ) {}

  private readonly logger = new Logger(PurchaseOrdersService.name);

  /** Event types that have active ERPNext mappers in the outbox-relay worker. */
  private static readonly OUTBOX_EVENT_TYPES = new Set([
    'goods_received',
    'goods_dispatched',
    'sales_invoiced',
    'purchase_invoiced',
  ]);

  private async writeEvent(
    tx: any,
    purchaseOrderId: string,
    eventType: string,
    payload: any,
    actor: string,
  ): Promise<void> {
    // Always write to the entity event table (audit log)
    await tx.insert(purchaseOrderEvents).values({
      purchaseOrderId,
      eventType,
      payload,
      actor,
    });

    // Only enqueue to the outbox if the worker has a mapper for this type
    if (PurchaseOrdersService.OUTBOX_EVENT_TYPES.has(eventType)) {
      await tx.insert(outbox).values({
        aggregateType: 'purchase_order',
        aggregateId: purchaseOrderId,
        eventType,
        payload,
      });
    }
  }

  async create(createDto: any, userId: string) {
    return await this.db.transaction(async (tx) => {
      // Create PO
      const [order] = await tx
        .insert(purchaseOrders)
        .values({
          orderNumber: createDto.orderNumber, // In reality, should auto-gen
          name: createDto.name,
          vendorId: createDto.vendorId,
          currencyCode: createDto.currencyCode || 'EUR',
          notes: createDto.notes,
          createdBy: userId,
          stateCode: 'draft',
        })
        .returning();

      // Create lines if any
      if (createDto.lines && createDto.lines.length > 0) {
        const lineValues = createDto.lines.map((line: any, index: number) => {
          const pricing = computeLinePriceForStorage({
            quantity: parseFloat(line.quantity || '0'),
            pricePerUnit: parseFloat(line.pricePerUnit || '0'),
            discountPercentage: parseFloat(line.discountPercentage || '0'),
          });

          return {
            purchaseOrderId: order.purchaseOrderId,
            lineNumber: index + 1,
            productId: line.productId,
            productDescription: line.productDescription,
            quantity: line.quantity.toString(),
            pricePerUnit: line.pricePerUnit.toString(),
            discountPercentage: line.discountPercentage?.toString() || '0',
            unitOfMeasure: line.unitOfMeasure || 'EA',
            amount: pricing.amount,
            totalAmount: pricing.totalAmount,
          };
        });

        await tx.insert(purchaseOrderLineItems).values(lineValues);
      }

      await this.writeEvent(
        tx,
        order.purchaseOrderId,
        'created',
        {
          orderNumber: order.orderNumber,
          vendorId: createDto.vendorId,
          lineCount: createDto.lines?.length || 0,
        },
        userId,
      );

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
      .where(eq(purchaseOrders.purchaseOrderId, id))
      .limit(1)
      .then((res: any[]) => res[0]);

    if (!rawOrder) {
      throw new NotFoundException(`Purchase Order ${id} not found`);
    }

    // Support both tuple JOIN structure (drizzle live engine) and flat structure (jest mocks)
    const poEntity = rawOrder.purchase_orders || rawOrder;
    const vendorName = rawOrder.suppliers?.name || poEntity.vendorId;

    const order = {
      ...poEntity,
      vendorName,
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

  async changeState(id: string, stateCode: string) {
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

    return await this.db.transaction(async (tx: DrizzleDB) => {
      await tx
        .update(purchaseOrders)
        .set({ stateCode, modifiedOn: new Date() })
        .where(eq(purchaseOrders.purchaseOrderId, id));

      await this.writeEvent(
        tx,
        id,
        'status_changed',
        {
          from: existing.stateCode,
          to: stateCode,
        },
        'system', // changeState doesn't take userId, usually called by controller
      );

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

      await this.writeEvent(
        tx,
        id,
        'archived',
        {
          from: existing.stateCode,
          to: 'archived',
        },
        actor,
      );

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

      await this.writeEvent(
        tx,
        id,
        'unarchived',
        {
          from: 'archived',
          to: 'cancelled',
        },
        actor,
      );

      return updated;
    });
  }

  async addLine(orderId: string, lineDto: any) {
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
      const pricing = computeLinePriceForStorage({
        quantity: qty,
        pricePerUnit: price,
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
        totalAmount: pricing.totalAmount,
      });

      await this.writeEvent(
        tx,
        orderId,
        'line_added',
        {
          productId: lineDto.productId,
          quantity: lineDto.quantity,
          pricePerUnit: lineDto.pricePerUnit,
        },
        'system',
      );

      return this.findOne(orderId, tx);
    });
  }

  async updateLine(orderId: string, lineId: string, lineDto: any) {
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

      // Recalculate amount if qty or price changed
      if (
        lineDto.quantity !== undefined ||
        lineDto.pricePerUnit !== undefined
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
        const pricing = computeLinePriceForStorage({
          quantity: qty,
          pricePerUnit: price,
          discountPercentage: disc,
        });
        updateFields.amount = pricing.amount;
        updateFields.totalAmount = pricing.totalAmount;
      }

      await tx
        .update(purchaseOrderLineItems)
        .set(updateFields)
        .where(eq(purchaseOrderLineItems.purchaseOrderLineId, lineId));

      await this.writeEvent(
        tx,
        orderId,
        'line_updated',
        {
          lineId,
          changes: updateFields,
        },
        'system',
      );

      return this.findOne(orderId, tx);
    });
  }

  async removeLine(orderId: string, lineId: string) {
    return await this.db.transaction(async (tx) => {
      const existing = await this.findOne(orderId, tx);
      if (existing.stateCode !== 'draft') {
        throw new BadRequestException(
          'Can only remove lines from draft purchase orders',
        );
      }

      await tx
        .delete(purchaseOrderLineItems)
        .where(eq(purchaseOrderLineItems.purchaseOrderLineId, lineId));

      await this.writeEvent(tx, orderId, 'line_removed', { lineId }, 'system');

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
          const lineValues = updateDto.lines.map(
            (line: any, index: number) => ({
              purchaseOrderId: id,
              lineNumber: index + 1,
              productId: line.productId,
              productDescription: line.productDescription,
              quantity: line.quantity.toString(),
              pricePerUnit: line.pricePerUnit.toString(),
              unitOfMeasure: line.unitOfMeasure || 'EA',
              amount: (line.quantity * line.pricePerUnit).toString(),
              totalAmount: (line.quantity * line.pricePerUnit).toString(),
            }),
          );
          await tx.insert(purchaseOrderLineItems).values(lineValues);
        }

        const audit = calculateAuditTrail(updateDto, existing, AuditMode.DIFF);
        if (audit.hasChanges) {
          await this.writeEvent(
            tx,
            id,
            'updated',
            {
              changes: audit.changes,
              previousValues: audit.previousValues,
              linesCount: updateDto.lines?.length,
            },
            userId,
          );
        }
      }

      return this.findOne(id, tx);
    });
  }
}

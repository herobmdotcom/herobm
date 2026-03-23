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
} from '../drizzle/modbm-core-schema';
import {
  purchaseOrderLines as abmPurchaseOrderLines,
  suppliers,
} from '../drizzle/schema';
import { eq, or, ilike, desc, sql, inArray } from 'drizzle-orm';
import { InventoryService } from '../inventory/inventory.service';
import { PaginationQuery, parsePagination } from '../common/pagination';
import { calculateAuditTrail, AuditMode } from '../common/audit';
import {
  PURCHASE_ORDER_TRANSITIONS,
  getValidStates,
  getAllowedTransitions,
} from '@modbm/shared';

export interface UnifiedPurchaseOrderRow {
  id: string;
  orderNumber: string;
  name: string;
  vendorName: string;
  invoiceNumber: string;
  stateCode: string;
  source: 'abm' | 'app';
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
          const qty = parseFloat(line.quantity || '0');
          const price = parseFloat(line.pricePerUnit || '0');
          const disc = parseFloat(line.discountPercentage || '0');
          const amount = (qty * price * (1 - disc / 100)).toFixed(2);

          return {
            purchaseOrderId: order.purchaseOrderId,
            lineNumber: index + 1,
            productId: line.productId,
            productDescription: line.productDescription,
            quantity: line.quantity.toString(),
            pricePerUnit: line.pricePerUnit.toString(),
            discountPercentage: line.discountPercentage?.toString() || '0',
            unitOfMeasure: line.unitOfMeasure || 'EA',
            amount: amount,
            totalAmount: amount, // simplify for now, no tax logic needed here initially
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
    const { page, limit, offset, searchTerm, includeArchived } =
      parsePagination(query);
    const stateFilter = query?.state ?? null;

    // --- ABM legacy orders ---
    let abmQuery = this.db
      .selectDistinctOn([abmPurchaseOrderLines.documentNumber], {
        id: abmPurchaseOrderLines.purchaseOrderLineId,
        orderNumber: abmPurchaseOrderLines.documentNumber,
        name: sql<string>`''`.as('name'),
        vendorName: abmPurchaseOrderLines.vendorName,
        invoiceNumber: sql<string>`''`.as('invoice_number'),
        stateCode: sql<string>`'legacy'`.as('state_code_unified'),
        source: sql<string>`'abm'`.as('source'),
        createdBy: sql<string>`''`.as('created_by'),
        createdOn: abmPurchaseOrderLines.documentDate,
        totalPrice: abmPurchaseOrderLines.documentTotalIncTax,
      })
      .from(abmPurchaseOrderLines)
      .$dynamic();

    if (searchTerm) {
      abmQuery = abmQuery.where(
        or(
          ilike(abmPurchaseOrderLines.documentNumber, searchTerm),
          ilike(abmPurchaseOrderLines.vendorName, searchTerm),
        ),
      );
    }

    // --- App orders ---
    let appQuery = this.db
      .select({
        id: purchaseOrders.purchaseOrderId,
        orderNumber: purchaseOrders.orderNumber,
        name: purchaseOrders.name,
        vendorName: suppliers.name,
        invoiceNumber: purchaseOrders.invoiceNumber,
        stateCode: purchaseOrders.stateCode,
        source: sql<string>`'app'`.as('source'),
        createdBy: purchaseOrders.createdBy,
        createdOn: purchaseOrders.createdOn,
        currencyCode: purchaseOrders.currencyCode,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.vendorId, suppliers.vendorId))
      .$dynamic();

    if (searchTerm) {
      appQuery = appQuery.where(
        or(
          ilike(purchaseOrders.orderNumber, searchTerm),
          ilike(purchaseOrders.name, searchTerm),
          ilike(suppliers.name, searchTerm),
        ),
      );
    }

    if (!includeArchived) {
      appQuery = appQuery.where(sql`${purchaseOrders.stateCode} != 'archived'`);
    }

    const [appRows, abmRows] = await Promise.all([appQuery, abmQuery]);

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

    const unified: UnifiedPurchaseOrderRow[] = [
      ...appRows.map((r) => ({
        id: r.id,
        orderNumber: r.orderNumber ?? '',
        name: r.name ?? '',
        vendorName: r.vendorName ?? '',
        invoiceNumber: r.invoiceNumber ?? '',
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
        name: r.name ?? '',
        vendorName: r.vendorName ?? '',
        invoiceNumber: r.invoiceNumber ?? '',
        stateCode: 'legacy',
        source: 'abm' as const,
        createdBy: '',
        createdOn: r.createdOn ? new Date(r.createdOn).toISOString() : null,
        totalPrice: r.totalPrice ?? null,
        currencyCode: null,
      })),
    ];

    const paginated = unified.slice(offset, offset + limit);

    return { data: paginated, page, limit, total: unified.length };
  }

  async findOne(id: string, tx: any = this.db) {
    const order = await tx
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, id))
      .limit(1)
      .then((res: any[]) => res[0]);

    if (!order) {
      throw new NotFoundException(`Purchase Order ${id} not found`);
    }

    const lines = await tx
      .select()
      .from(purchaseOrderLineItems)
      .where(eq(purchaseOrderLineItems.purchaseOrderId, id))
      .orderBy(purchaseOrderLineItems.lineNumber);

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
      lines: lines.map((l: any) => ({
        ...l,
        salesOrderLineId: l.purchaseOrderLineId,
      })),
      events,
    };
  }

  async findAbmPurchaseOrder(documentNumber: string) {
    const lines = await this.db
      .select()
      .from(abmPurchaseOrderLines)
      .where(eq(abmPurchaseOrderLines.documentNumber, documentNumber));

    if (lines.length === 0) {
      throw new NotFoundException(
        `ABM Purchase Order ${documentNumber} not found`,
      );
    }

    return {
      orderNumber: documentNumber,
      vendorName: lines[0].vendorName,
      stateCode: 'legacy',
      source: 'abm' as const,
      createdOn: lines[0].documentDate
        ? new Date(lines[0].documentDate).toISOString()
        : null,
      documentTotalIncTax: lines[0].documentTotalIncTax,
      documentTotalExTax: lines[0].documentTotalExTax,
      documentTotalTax: lines[0].documentTotalTax,
      lines: lines.map((l) => ({
        purchaseOrderLineId: l.purchaseOrderLineId,
        salesOrderLineId: l.purchaseOrderLineId,
        lineNumber: l.lineNumber,
        productId: l.productId,
        productNumber: l.productNumber,
        productDescription: l.productDescription,
        supplierPartNumber: l.supplierPartNumber,
        unitOfMeasure: l.unitOfMeasure,
        quantity: l.quantity,
        pricePerUnit: l.pricePerUnit,
        discountPercentage: l.discountPercentage,
        amount: l.amount,
        tax: l.tax,
        totalAmount: l.totalAmount,
        quantityDelivered: l.quantityDelivered,
        quantityReceived: l.quantityDelivered,
      })),
      events: [], // Legacy orders have no audit trail
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

    const stockLines = existing.lines.map((l: any) => ({
      productId: l.productId,
      quantity: l.quantity,
    }));

    // States where stock is on-order
    const ON_ORDER_STATES = ['ordered'];

    return await this.db.transaction(async (tx: DrizzleDB) => {
      await tx
        .update(purchaseOrders)
        .set({ stateCode, modifiedOn: new Date() })
        .where(eq(purchaseOrders.purchaseOrderId, id));

      // ── Inventory hooks ──
      // Ordering → place on order
      if (
        stateCode === 'ordered' &&
        !ON_ORDER_STATES.includes(existing.stateCode)
      ) {
        await this.inventoryService.placeOnOrder(tx, stockLines);
      }
      // Cancelling from ordered → cancel on order
      if (
        stateCode === 'cancelled' &&
        ON_ORDER_STATES.includes(existing.stateCode)
      ) {
        await this.inventoryService.cancelOnOrder(tx, stockLines);
      }

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
      const amount = (qty * price).toString();

      await tx.insert(purchaseOrderLineItems).values({
        purchaseOrderId: orderId,
        lineNumber: maxLine + 1,
        productId: lineDto.productId,
        productDescription: lineDto.productDescription,
        quantity: lineDto.quantity?.toString() || '1',
        pricePerUnit: lineDto.pricePerUnit?.toString() || '0',
        discountPercentage: lineDto.discountPercentage?.toString() || '0',
        unitOfMeasure: lineDto.unitOfMeasure || 'EA',
        amount,
        totalAmount: amount,
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
        const amount = qty * price * (1 - disc / 100);
        updateFields.amount = amount.toFixed(2);
        updateFields.totalAmount = amount.toFixed(2);
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

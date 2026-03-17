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
} from '../drizzle/modbm-core-schema';
import {
  purchaseOrderLines as abmPurchaseOrderLines,
  suppliers,
} from '../drizzle/schema';
import { eq, or, ilike, desc, sql, inArray } from 'drizzle-orm';
import { InventoryService } from '../inventory/inventory.service';
import { PaginationQuery, parsePagination } from '../common/pagination';

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
        const lineValues = createDto.lines.map((line: any, index: number) => ({
          purchaseOrderId: order.purchaseOrderId,
          lineNumber: index + 1,
          productId: line.productId,
          productDescription: line.productDescription,
          quantity: line.quantity.toString(),
          pricePerUnit: line.pricePerUnit.toString(),
          unitOfMeasure: line.unitOfMeasure || 'EA',
          amount: (line.quantity * line.pricePerUnit).toString(),
          totalAmount: (line.quantity * line.pricePerUnit).toString(), // simplify for now, no tax logic needed here initially
        }));

        await tx.insert(purchaseOrderLineItems).values(lineValues);
      }

      return this.findOne(order.purchaseOrderId, tx);
    });
  }

  async findAll(query?: PaginationQuery) {
    const { page, limit, offset, searchTerm } = parsePagination(query);
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
        quantityInvoiced: l.quantityInvoiced,
      })),
    };
  }

  async changeState(id: string, stateCode: string) {
    const existing = await this.findOne(id);
    if (!existing) {
      throw new NotFoundException(`Purchase Order ${id} not found`);
    }

    const stockLines = existing.lines.map((l: any) => ({
      productId: l.productId,
      quantity: l.quantity,
    }));

    // States where stock is on-order
    const ON_ORDER_STATES = ['ordered'];

    return await this.db.transaction(async (tx: any) => {
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

      return this.findOne(id, tx);
    });
  }

  async addLine(orderId: string, lineDto: any) {
    const existing = await this.findOne(orderId);
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

    await this.db.insert(purchaseOrderLineItems).values({
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

    return this.findOne(orderId);
  }

  async updateLine(orderId: string, lineId: string, lineDto: any) {
    const existing = await this.findOne(orderId);
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
    if (lineDto.quantity !== undefined || lineDto.pricePerUnit !== undefined) {
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

    await this.db
      .update(purchaseOrderLineItems)
      .set(updateFields)
      .where(eq(purchaseOrderLineItems.purchaseOrderLineId, lineId));

    return this.findOne(orderId);
  }

  async removeLine(orderId: string, lineId: string) {
    const existing = await this.findOne(orderId);
    if (existing.stateCode !== 'draft') {
      throw new BadRequestException(
        'Can only remove lines from draft purchase orders',
      );
    }

    await this.db
      .delete(purchaseOrderLineItems)
      .where(eq(purchaseOrderLineItems.purchaseOrderLineId, lineId));

    return this.findOne(orderId);
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
      }

      return this.findOne(id, tx);
    });
  }
}

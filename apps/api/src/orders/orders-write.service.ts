import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderLineItems,
  orderEvents,
  outbox,
} from '../drizzle/modbm-core-schema';
import { accounts } from '../drizzle/schema';
import { products } from '../drizzle/schema';
import { GstCategoriesService } from '../gst/gst-categories.service';

// Valid state transitions (from → allowed next states)
const STATE_TRANSITIONS: Record<string, string[]> = {
  draft: ['quoted', 'cancelled'],
  quoted: ['confirmed', 'draft', 'cancelled'],
  confirmed: ['picking', 'cancelled'],
  picking: ['shipped', 'confirmed'],
  shipped: ['invoiced'],
  invoiced: [],
  cancelled: ['draft'],
};

const VALID_STATES = Object.keys(STATE_TRANSITIONS);

interface CreateOrderDto {
  name?: string;
  customerId: string;
  customerOrderNumber?: string;
  notes?: string;
  lines: Array<{
    productId: string;
    productDescription?: string;
    quantity: string;
    pricePerUnit: string;
    discountPercentage?: string;
    gstCategoryId?: string;
    unitOfMeasure?: string;
  }>;
}

interface UpdateOrderDto {
  name?: string;
  customerOrderNumber?: string;
  notes?: string;
}

interface AddLineDto {
  productId: string;
  productDescription?: string;
  quantity: string;
  pricePerUnit: string;
  discountPercentage?: string;
  gstCategoryId?: string;
  unitOfMeasure?: string;
}

interface UpdateLineDto {
  quantity?: string;
  pricePerUnit?: string;
  discountPercentage?: string;
  gstCategoryId?: string;
  productDescription?: string;
  unitOfMeasure?: string;
}

@Injectable()
export class OrdersWriteService {
  constructor(
    @Inject(DRIZZLE) private db: any,
    private readonly gstService: GstCategoriesService,
  ) {}

  private get database(): DrizzleDB {
    return this.db as DrizzleDB;
  }

  /**
   * Generate a human-readable order number (ORD-YYYYMMDD-NNNN).
   */
  private async generateOrderNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `ORD-${today}-`;

    // Find the highest sequence for today
    const result = await this.database
      .select({ orderNumber: salesOrders.orderNumber })
      .from(salesOrders)
      .where(sql`${salesOrders.orderNumber} LIKE ${prefix + '%'}`)
      .orderBy(sql`${salesOrders.orderNumber} DESC`)
      .limit(1);

    const seq = result.length > 0
      ? parseInt(result[0].orderNumber.replace(prefix, ''), 10) + 1
      : 1;

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /**
   * Compute line amount: qty × price × (1 − discount/100)
   * Tax is auto-calculated from the GST rate.
   */
  private computeLineAmount(
    quantity: string,
    pricePerUnit: string,
    discountPercentage: string,
    gstRate: number,
  ): { amount: string; tax: string; totalAmount: string } {
    const qty = parseFloat(quantity);
    const price = parseFloat(pricePerUnit);
    const disc = parseFloat(discountPercentage || '0');
    const amount = qty * price * (1 - disc / 100);
    const tax = amount * (gstRate / 100);
    return {
      amount: amount.toFixed(2),
      tax: tax.toFixed(2),
      totalAmount: (amount + tax).toFixed(2),
    };
  }
  // ABM gst_category text → our GST category code mapping
  private static readonly GST_CATEGORY_MAP: Record<string, string> = {
    '9% gst': 'GST',
    'zero rated products': 'ZR',
    'exempt customer': 'EXE',
  };

  /**
   * Resolve the GST category for a single order line.
   *
   * Priority:
   *   1. Explicit per-line override (gstCategoryIdOverride) — manual escape hatch
   *   2. Customer exempt → EXE (0%) regardless of product
   *   3. Product's ABM gst_category mapped to our code (GST, ZR, EXE)
   *   4. System default GST (fallback)
   */
  private async resolveGstForLine(
    customerId: string,
    productId?: string,
    gstCategoryIdOverride?: string,
  ): Promise<{ gstCategoryId: string; rate: number }> {
    // 1. Explicit override wins
    if (gstCategoryIdOverride) {
      const cat = await this.gstService.getById(gstCategoryIdOverride);
      return { gstCategoryId: cat.gstCategoryId, rate: parseFloat(cat.rate ?? '0') };
    }

    // 2. Customer exempt → always 0%
    const custRows = await this.database
      .select({ gstPosition: accounts.gstPosition })
      .from(accounts)
      .where(eq(accounts.accountId, customerId))
      .limit(1);

    const gstPosition = custRows.length > 0 ? custRows[0].gstPosition : null;

    if (gstPosition?.toLowerCase() === 'exempt') {
      const exempt = await this.gstService.getByCode('EXE');
      return { gstCategoryId: exempt.gstCategoryId, rate: parseFloat(exempt.rate ?? '0') };
    }

    // 3. Product's GST category
    if (productId) {
      const product = await this.lookupProduct(productId);
      if (product.gstCategory) {
        const code = OrdersWriteService.GST_CATEGORY_MAP[product.gstCategory.toLowerCase()];
        if (code) {
          const cat = await this.gstService.getByCode(code);
          return { gstCategoryId: cat.gstCategoryId, rate: parseFloat(cat.rate ?? '0') };
        }
      }
    }

    // 4. Fallback: system default
    const defaultGst = await this.gstService.getDefault();
    return { gstCategoryId: defaultGst.gstCategoryId, rate: parseFloat(defaultGst.rate ?? '0') };
  }

  /**
   * Resolve a customer from mart_accounts.
   * Throws BadRequestException if not found.
   * Returns the customer discount percentage.
   */
  private async resolveCustomer(customerId: string): Promise<{
    customerDiscount: string;
    currencyCode: string;
  }> {
    const rows = await this.database
      .select({
        id: accounts.accountId,
        customerDiscount: accounts.customerDiscount,
        currencyCode: accounts.currencyCode,
      })
      .from(accounts)
      .where(eq(accounts.accountId, customerId))
      .limit(1);

    if (rows.length === 0) {
      throw new BadRequestException(`Customer '${customerId}' not found`);
    }

    return {
      customerDiscount: rows[0].customerDiscount ?? '0',
      currencyCode: rows[0].currencyCode ?? 'EUR',
    };
  }

  /**
   * Look up a product from mart_products.
   * Throws BadRequestException if not found.
   * Returns productId and gstCategory.
   */
  private async lookupProduct(productId: string): Promise<{
    productId: string;
    gstCategory: string | null;
  }> {
    const rows = await this.database
      .select({
        productId: products.productId,
        gstCategory: products.gstCategory,
      })
      .from(products)
      .where(eq(products.productId, productId))
      .limit(1);

    if (rows.length === 0) {
      throw new BadRequestException(`Product '${productId}' not found`);
    }

    return rows[0];
  }

  /**
   * Validate that a product exists in mart_products.
   */
  private async validateProduct(productId: string): Promise<void> {
    await this.lookupProduct(productId);
  }

  /**
   * Write an audit event and outbox record in the same transaction scope.
   */
  private async writeEvent(
    tx: any,
    salesOrderId: string,
    eventType: string,
    payload: any,
    actor: string,
  ): Promise<void> {
    await tx.insert(orderEvents).values({
      salesOrderId,
      eventType,
      payload,
      actor,
    });

    await tx.insert(outbox).values({
      aggregateType: 'sales_order',
      aggregateId: salesOrderId,
      eventType,
      payload,
    });
  }

  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------

  /**
   * Create a new sales order with line items.
   */
  async create(dto: CreateOrderDto, actor: string) {
    const customer = await this.resolveCustomer(dto.customerId);

    // Resolve order-level GST from the first line's product, or customer default
    const firstProductId = dto.lines.length > 0 ? dto.lines[0].productId : undefined;
    const headerGst = await this.resolveGstForLine(dto.customerId, firstProductId);

    for (const line of dto.lines) {
      if (line.productId) {
        await this.validateProduct(line.productId);
      }
    }

    const orderNumber = await this.generateOrderNumber();

    const result = await this.database.transaction(async (tx: any) => {
      // Insert order header with snapshotted customer discount + GST category
      const [order] = await tx
        .insert(salesOrders)
        .values({
          orderNumber,
          name: dto.name || orderNumber,
          customerId: dto.customerId,
          customerOrderNumber: dto.customerOrderNumber,
          stateCode: 'draft',
          customerDiscount: customer.customerDiscount,
          gstCategoryId: headerGst.gstCategoryId,
          currencyCode: customer.currencyCode,
          notes: dto.notes,
          createdBy: actor,
        })
        .returning();

      // Insert line items — resolve GST per line (product × customer)
      const lineValues = [];
      for (let idx = 0; idx < dto.lines.length; idx++) {
        const line = dto.lines[idx];
        const lineGst = await this.resolveGstForLine(
          dto.customerId,
          line.productId,
          line.gstCategoryId,
        );
        const lineDiscount = line.discountPercentage ?? customer.customerDiscount;
        const computed = this.computeLineAmount(
          line.quantity,
          line.pricePerUnit,
          lineDiscount,
          lineGst.rate,
        );
        lineValues.push({
          salesOrderId: order.salesOrderId,
          lineNumber: idx + 1,
          productId: line.productId,
          productDescription: line.productDescription,
          quantity: line.quantity,
          pricePerUnit: line.pricePerUnit,
          discountPercentage: lineDiscount,
          gstCategoryId: lineGst.gstCategoryId,
          amount: computed.amount,
          tax: computed.tax,
          totalAmount: computed.totalAmount,
          unitOfMeasure: line.unitOfMeasure,
        });
      }

      if (lineValues.length > 0) {
        await tx.insert(salesOrderLineItems).values(lineValues);
      }

      // Audit + outbox
      await this.writeEvent(tx, order.salesOrderId, 'created', {
        orderNumber,
        customerId: dto.customerId,
        lineCount: lineValues.length,
      }, actor);

      return order;
    });

    return result;
  }

  /**
   * Update order header fields (name, notes, customer PO).
   */
  async update(id: string, dto: UpdateOrderDto, actor: string) {
    const existing = await this.findOrder(id);

    if (existing.stateCode === 'invoiced' || existing.stateCode === 'cancelled') {
      throw new BadRequestException(
        `Cannot update order in state '${existing.stateCode}'`,
      );
    }

    const result = await this.database.transaction(async (tx: any) => {
      const [updated] = await tx
        .update(salesOrders)
        .set({
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.customerOrderNumber !== undefined && {
            customerOrderNumber: dto.customerOrderNumber,
          }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          modifiedOn: new Date(),
        })
        .where(eq(salesOrders.salesOrderId, id))
        .returning();

      await this.writeEvent(tx, id, 'updated', {
        changes: dto,
        previousValues: {
          name: existing.name,
          customerOrderNumber: existing.customerOrderNumber,
          notes: existing.notes,
        },
      }, actor);

      return updated;
    });

    return result;
  }

  /**
   * Transition order state (e.g. draft → quoted → confirmed).
   */
  async changeState(id: string, newState: string, actor: string) {
    if (!VALID_STATES.includes(newState)) {
      throw new BadRequestException(`Invalid state: '${newState}'`);
    }

    const existing = await this.findOrder(id);
    const allowed = STATE_TRANSITIONS[existing.stateCode];

    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition from '${existing.stateCode}' to '${newState}'. ` +
        `Allowed transitions: ${allowed?.join(', ') || 'none'}`,
      );
    }

    const result = await this.database.transaction(async (tx: any) => {
      const [updated] = await tx
        .update(salesOrders)
        .set({ stateCode: newState, modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, id))
        .returning();

      await this.writeEvent(tx, id, 'status_changed', {
        from: existing.stateCode,
        to: newState,
      }, actor);

      return updated;
    });

    return result;
  }

  /**
   * Add a line item to an existing order.
   */
  async addLine(orderId: string, dto: AddLineDto, actor: string) {
    const order = await this.findOrder(orderId);

    if (['invoiced', 'shipped', 'cancelled'].includes(order.stateCode)) {
      throw new BadRequestException(
        `Cannot add lines to order in state '${order.stateCode}'`,
      );
    }

    if (dto.productId) {
      await this.validateProduct(dto.productId);
    }

    // Get next line number
    const maxLine = await this.database
      .select({ max: sql<number>`COALESCE(MAX(${salesOrderLineItems.lineNumber}), 0)` })
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, orderId));

    const lineNumber = (maxLine[0]?.max ?? 0) + 1;

    // Resolve GST: product × customer intersection, with per-line override
    const lineGst = await this.resolveGstForLine(
      order.customerId ?? '',
      dto.productId,
      dto.gstCategoryId,
    );
    const gstCategoryId = lineGst.gstCategoryId;
    const gstRate = lineGst.rate;

    const lineDiscount = dto.discountPercentage ?? order.customerDiscount ?? '0';

    const computed = this.computeLineAmount(
      dto.quantity,
      dto.pricePerUnit,
      lineDiscount,
      gstRate,
    );

    const result = await this.database.transaction(async (tx: any) => {
      const [line] = await tx
        .insert(salesOrderLineItems)
        .values({
          salesOrderId: orderId,
          lineNumber,
          productId: dto.productId,
          productDescription: dto.productDescription,
          quantity: dto.quantity,
          pricePerUnit: dto.pricePerUnit,
          discountPercentage: lineDiscount,
          gstCategoryId,
          amount: computed.amount,
          tax: computed.tax,
          totalAmount: computed.totalAmount,
          unitOfMeasure: dto.unitOfMeasure,
        })
        .returning();

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      await this.writeEvent(tx, orderId, 'line_added', {
        lineId: line.salesOrderLineId,
        productId: dto.productId,
        quantity: dto.quantity,
        gstCategoryId,
      }, actor);

      return line;
    });

    return result;
  }

  /**
   * Update a line item.
   */
  async updateLine(
    orderId: string,
    lineId: string,
    dto: UpdateLineDto,
    actor: string,
  ) {
    const order = await this.findOrder(orderId);

    if (['invoiced', 'shipped', 'cancelled'].includes(order.stateCode)) {
      throw new BadRequestException(
        `Cannot update lines on order in state '${order.stateCode}'`,
      );
    }

    const existingLine = await this.findLine(lineId, orderId);

    // Resolve GST: dto override → existing line category → product-based resolution
    let gstCategoryId = existingLine.gstCategoryId ?? order.gstCategoryId;
    let gstRate = 0;
    if (dto.gstCategoryId) {
      // Explicit override via DTO
      const cat = await this.gstService.getById(dto.gstCategoryId);
      gstCategoryId = cat.gstCategoryId;
      gstRate = parseFloat(cat.rate ?? '0');
    } else if (gstCategoryId) {
      // Keep existing line or order category
      const cat = await this.gstService.getById(gstCategoryId);
      gstRate = parseFloat(cat.rate ?? '0');
    }

    const quantity = dto.quantity ?? existingLine.quantity;
    const pricePerUnit = dto.pricePerUnit ?? existingLine.pricePerUnit;
    const discountPercentage = dto.discountPercentage ?? existingLine.discountPercentage ?? '0';

    const computed = this.computeLineAmount(quantity, pricePerUnit, discountPercentage, gstRate);

    const result = await this.database.transaction(async (tx: any) => {
      const [updated] = await tx
        .update(salesOrderLineItems)
        .set({
          ...(dto.quantity !== undefined && { quantity: dto.quantity }),
          ...(dto.pricePerUnit !== undefined && { pricePerUnit: dto.pricePerUnit }),
          ...(dto.discountPercentage !== undefined && {
            discountPercentage: dto.discountPercentage,
          }),
          ...(dto.gstCategoryId !== undefined && { gstCategoryId: dto.gstCategoryId }),
          ...(dto.productDescription !== undefined && {
            productDescription: dto.productDescription,
          }),
          ...(dto.unitOfMeasure !== undefined && { unitOfMeasure: dto.unitOfMeasure }),
          amount: computed.amount,
          tax: computed.tax,
          totalAmount: computed.totalAmount,
        })
        .where(eq(salesOrderLineItems.salesOrderLineId, lineId))
        .returning();

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      await this.writeEvent(tx, orderId, 'line_updated', {
        lineId,
        changes: dto,
        previousValues: {
          quantity: existingLine.quantity,
          pricePerUnit: existingLine.pricePerUnit,
          discountPercentage: existingLine.discountPercentage,
          gstCategoryId: existingLine.gstCategoryId,
        },
      }, actor);

      return updated;
    });

    return result;
  }

  /**
   * Remove a line item.
   */
  async removeLine(orderId: string, lineId: string, actor: string) {
    const order = await this.findOrder(orderId);

    if (['invoiced', 'shipped', 'cancelled'].includes(order.stateCode)) {
      throw new BadRequestException(
        `Cannot remove lines from order in state '${order.stateCode}'`,
      );
    }

    const existingLine = await this.findLine(lineId, orderId);

    await this.database.transaction(async (tx: any) => {
      await tx
        .delete(salesOrderLineItems)
        .where(eq(salesOrderLineItems.salesOrderLineId, lineId));

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      await this.writeEvent(tx, orderId, 'line_removed', {
        lineId,
        productId: existingLine.productId,
        quantity: existingLine.quantity,
      }, actor);
    });
  }

  /**
   * Get a single order with its line items and events.
   */
  async findOne(id: string) {
    const order = await this.findOrder(id);

    const lines = await this.database
      .select()
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, id))
      .orderBy(salesOrderLineItems.lineNumber);

    const events = await this.database
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.salesOrderId, id))
      .orderBy(orderEvents.createdOn);

    return { ...order, lines, events };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async findOrder(id: string) {
    const rows = await this.database
      .select()
      .from(salesOrders)
      .where(eq(salesOrders.salesOrderId, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Order '${id}' not found`);
    }
    return rows[0];
  }

  private async findLine(lineId: string, orderId: string) {
    const rows = await this.database
      .select()
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderLineId, lineId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Line '${lineId}' not found`);
    }

    if (rows[0].salesOrderId !== orderId) {
      throw new BadRequestException(
        `Line '${lineId}' does not belong to order '${orderId}'`,
      );
    }

    return rows[0];
  }
}

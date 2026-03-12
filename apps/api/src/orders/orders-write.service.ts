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

  /**
   * Resolve GST category for a customer based on their GST position.
   * - Exempt customers → Exempt category
   * - Taxable customers (or unknown) → system default GST category
   */
  private async resolveGstForCustomer(customerId: string): Promise<{ gstCategoryId: string; rate: number }> {
    // Check customer GST position from mart_accounts
    const rows = await this.database
      .select({ gstPosition: accounts.gstPosition })
      .from(accounts)
      .where(eq(accounts.accountId, customerId))
      .limit(1);

    const gstPosition = rows.length > 0 ? rows[0].gstPosition : null;

    if (gstPosition?.toLowerCase() === 'exempt') {
      const exempt = await this.gstService.getByCode('EXE');
      return { gstCategoryId: exempt.gstCategoryId, rate: parseFloat(exempt.rate ?? '0') };
    }

    // Default: taxable → system default GST
    const defaultGst = await this.gstService.getDefault();
    return { gstCategoryId: defaultGst.gstCategoryId, rate: parseFloat(defaultGst.rate ?? '0') };
  }

  /**
   * Resolve a customer from mart_accounts.
   * Returns the customer's discount percentage for snapshotting onto the order.
   */
  private async resolveCustomer(customerId: string): Promise<{ customerDiscount: string }> {
    const rows = await this.database
      .select({
        id: accounts.accountId,
        customerDiscount: accounts.customerDiscount,
      })
      .from(accounts)
      .where(eq(accounts.accountId, customerId))
      .limit(1);

    if (rows.length === 0) {
      throw new BadRequestException(`Customer '${customerId}' not found`);
    }
    return { customerDiscount: rows[0].customerDiscount ?? '0' };
  }

  /**
   * Validate that a product exists in mart_products.
   */
  private async validateProduct(productId: string): Promise<void> {
    const rows = await this.database
      .select({ id: products.productId })
      .from(products)
      .where(eq(products.productId, productId))
      .limit(1);

    if (rows.length === 0) {
      throw new BadRequestException(`Product '${productId}' not found`);
    }
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
    const gst = await this.resolveGstForCustomer(dto.customerId);

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
          gstCategoryId: gst.gstCategoryId,
          notes: dto.notes,
          createdBy: actor,
        })
        .returning();

      // Insert line items — resolve GST per line (inherit from order or use per-line override)
      const lineValues = [];
      for (let idx = 0; idx < dto.lines.length; idx++) {
        const line = dto.lines[idx];
        let lineGstId = gst.gstCategoryId;
        let lineRate = gst.rate;
        if (line.gstCategoryId) {
          const lineGst = await this.gstService.getById(line.gstCategoryId);
          lineGstId = lineGst.gstCategoryId;
          lineRate = parseFloat(lineGst.rate ?? '0');
        }
        const lineDiscount = line.discountPercentage ?? customer.customerDiscount;
        const computed = this.computeLineAmount(
          line.quantity,
          line.pricePerUnit,
          lineDiscount,
          lineRate,
        );
        lineValues.push({
          salesOrderId: order.salesOrderId,
          lineNumber: idx + 1,
          productId: line.productId,
          productDescription: line.productDescription,
          quantity: line.quantity,
          pricePerUnit: line.pricePerUnit,
          discountPercentage: lineDiscount,
          gstCategoryId: lineGstId,
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

    // Resolve GST: use per-line override, or inherit from order
    let gstCategoryId = dto.gstCategoryId || order.gstCategoryId;
    let gstRate = 0;
    if (gstCategoryId) {
      const gstCat = await this.gstService.getById(gstCategoryId);
      gstRate = parseFloat(gstCat.rate ?? '0');
    } else {
      // Fallback: system default
      const defaultGst = await this.gstService.getDefault();
      gstCategoryId = defaultGst.gstCategoryId;
      gstRate = parseFloat(defaultGst.rate ?? '0');
    }

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

    // Resolve GST category: use dto override, or keep existing, or fallback to order
    const gstCategoryId = dto.gstCategoryId ?? existingLine.gstCategoryId ?? order.gstCategoryId;
    let gstRate = 0;
    if (gstCategoryId) {
      const gstCat = await this.gstService.getById(gstCategoryId);
      gstRate = parseFloat(gstCat.rate ?? '0');
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

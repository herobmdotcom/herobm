import { HttpException, HttpStatus } from '@nestjs/common';
import { BackordersService } from './backorders.service';
import { InventoryGap } from '@modbm/shared';
import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, sql, inArray } from 'drizzle-orm';
import { AppConfigService } from '../settings/app-config.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderLineItems,
  orderEvents,
  accounts as coreAccounts,
  products as coreProducts,
  backorders,
  purchaseOrders,
  locations,
  productUoms,
} from '../drizzle/modbm-core-schema';
import {
  CreateOrderDto,
  UpdateOrderDto,
  CreateOrderLineDto as AddLineDto, // Renamed to match usage
  UpdateOrderLineDto as UpdateLineDto,
} from './dto';
import { calculateAuditTrail, AuditMode } from '../common/audit';
import { findOrderLine as sharedFindOrderLine } from './shipment-helpers';
import { emitEvent } from '../common/emit-event';
import { AggregateType } from '../common/event-types';

import { TaxCategoriesService } from '../tax/tax-categories.service';
import { PickingService } from './picking.service';
import { InventoryService } from '../inventory/inventory.service';
import { AccountsService } from '../accounts/accounts.service';
import { CreditAssessmentService } from '../accounts/credit-assessment.service';
import { ProductsService } from '../products/products.service';
import {
  SALES_ORDER_TRANSITIONS as STATE_TRANSITIONS,
  getValidStates,
  computeLinePriceForStorage,
  resolveEffectiveDiscount,
} from '@modbm/shared';
import {
  resolveEffectiveCreditHold,
  resolveEffectiveCreditLimit,
} from '../accounts/credit-control.utils';

const VALID_STATES = getValidStates(STATE_TRANSITIONS);

// DTOs imported from ./dto

@Injectable()
export class OrdersWriteService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly taxService: TaxCategoriesService,
    private readonly pickingService: PickingService,
    private readonly inventoryService: InventoryService,
    private readonly accountsService: AccountsService,
    private readonly creditAssessmentService: CreditAssessmentService,
    private readonly productsService: ProductsService,
    private readonly backordersService: BackordersService,
    private readonly appConfig: AppConfigService,
  ) {}

  private readonly logger = new Logger(OrdersWriteService.name);

  /**
   * Generate a human-readable order number (ORD-YYYYMMDD-NNNN).
   * Must be called inside a transaction to prevent race conditions.
   * Uses FOR UPDATE to serialize concurrent callers.
   */
  private async generateOrderNumber(tx?: DrizzleDB): Promise<string> {
    const db = tx || this.db;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `ORD-${today}-`;

    // Find the highest sequence for today, locking the row to prevent races
    const result = await db.execute(
      sql`SELECT order_number FROM modbm_core.sales_orders
          WHERE order_number LIKE ${prefix + '%'}
          ORDER BY order_number DESC
          LIMIT 1
          FOR UPDATE`,
    );

    const rows = result as unknown as { order_number: string }[];
    const seq =
      rows.length > 0
        ? parseInt(rows[0].order_number.replace(prefix, ''), 10) + 1
        : 1;

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /**
   * Compute line amount: qty × price × (1 − discount/100)
   * Tax is auto-calculated from the GST rate.
   * Delegates to the shared pricing module.
   */
  private computeLineAmount(
    quantity: string,
    pricePerUnit: string,
    discountPercentage: string,
    taxRate: number,
  ): { amount: string; tax: string; totalAmount: string } {
    return computeLinePriceForStorage({
      quantity: parseFloat(quantity),
      pricePerUnit: parseFloat(pricePerUnit),
      discountPercentage: parseFloat(discountPercentage || '0'),
      taxRate: taxRate,
    });
  }
  // ABM tax_category text mapping has been migrated directly into modbm_core.products schema
  /**
   * Resolve the GST category for a single order line.
   *
   * Priority:
   *   1. Explicit per-line override (taxCategoryIdOverride) — manual escape hatch
   *   2. Customer exempt → EXE (0%) regardless of product
   *   3. Product's physical taxCategoryId foreign key
   *   4. System default GST (fallback)
   */
  private async resolveTaxForLine(
    customerId: string,
    productId?: string,
    taxCategoryIdOverride?: string,
  ): Promise<{ taxCategoryId: string; rate: number }> {
    // 1. Explicit override wins
    if (taxCategoryIdOverride) {
      const cat = await this.taxService.getById(taxCategoryIdOverride);
      return {
        taxCategoryId: cat.taxCategoryId,
        rate: parseFloat(cat.rate ?? '0'),
      };
    }

    // 2. Customer exempt → always 0%
    const account = await this.accountsService.findOne(customerId);

    if (account.taxCategoryId) {
      const acctCat = await this.taxService.getById(account.taxCategoryId);
      if (acctCat.code === 'EXE') {
        return {
          taxCategoryId: acctCat.taxCategoryId,
          rate: parseFloat(acctCat.rate ?? '0'),
        };
      }
    }

    // 3. Product's GST category
    if (productId) {
      const product = await this.lookupProduct(productId);
      if (product.salesTaxCategoryId) {
        try {
          const cat = await this.taxService.getById(product.salesTaxCategoryId);
          return {
            taxCategoryId: cat.taxCategoryId,
            rate: parseFloat(cat.rate ?? '0'),
          };
        } catch (err) {
          // Bad link, fallback to default
          this.logger.warn(
            `Product ${productId} had invalid tax category ID: ${product.salesTaxCategoryId}`,
          );
        }
      }
    }

    // 4. Fallback: system default
    const defaultGst = await this.taxService.getDefault();
    return {
      taxCategoryId: defaultGst.taxCategoryId,
      rate: parseFloat(defaultGst.rate ?? '0'),
    };
  }

  /**
   * Resolve a customer from modbm_core.accounts.
   * Throws BadRequestException if not found.
   * Returns the customer discount percentage.
   */
  private async resolveCustomer(customerId: string): Promise<{
    customerDiscount: string;
    currencyCode: string;
  }> {
    try {
      const account = await this.accountsService.findOne(customerId);
      const effectiveDiscount = resolveEffectiveDiscount(
        account.customerDiscount,
        (account as any).accountGroupDiscount,
      );

      return {
        customerDiscount: effectiveDiscount,
        currencyCode: account.currencyCode ?? 'EUR',
      };
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw new BadRequestException(`Customer '${customerId}' not found`);
      }
      throw err;
    }
  }

  /**
   * Asserts that an account is valid for ordering.
   * Checks state, credit hold, and credit limit.
   */
  private async assertAccountStanding(
    customerId: string,
    additionalExposure: number,
    operation: 'create' | 'update' | 'confirm',
  ): Promise<void> {
    const account = await this.accountsService.findOne(customerId);

    // 1. Strict State Block
    if (account.stateCode === 'inactive' || account.stateCode === 'archived') {
      throw new BadRequestException(
        `Cannot ${operation} order: Account '${account.name}' is ${account.stateCode}.`,
      );
    }

    // 2. Credit Hold Status
    const isHold = resolveEffectiveCreditHold({
      creditLimit: account.creditLimit,
      isOnCreditHold: account.isOnCreditHold,
      tradingTermsId: account.tradingTermsId,
      accountGroup: {
        creditLimit: (account as any).accountGroupCreditLimit,
        isOnCreditHold: (account as any).accountGroupIsOnCreditHold,
        tradingTermsId: (account as any).accountGroupTradingTermsId,
      },
    });

    if (isHold && (operation === 'confirm' || operation === 'update')) {
      throw new BadRequestException(
        `Cannot ${operation} order: Account '${account.name}' is on strict Credit Hold.`,
      );
    }

    // 3. Credit Assessment (Limits and Overdue)
    const assessment =
      await this.creditAssessmentService.assessCredit(customerId);

    if (assessment.isOverdue && operation === 'confirm') {
      throw new BadRequestException(
        `Cannot confirm order: Account has $${assessment.overdueBalance.toFixed(2)} in overdue balances.`,
      );
    }

    const limitStr = resolveEffectiveCreditLimit({
      creditLimit: account.creditLimit,
      isOnCreditHold: account.isOnCreditHold,
      tradingTermsId: account.tradingTermsId,
      accountGroup: {
        creditLimit: (account as any).accountGroupCreditLimit,
        isOnCreditHold: (account as any).accountGroupIsOnCreditHold,
        tradingTermsId: (account as any).accountGroupTradingTermsId,
      },
    });

    const creditLimit = parseFloat(limitStr);

    // If limits apply, check exposure
    if (creditLimit >= 0) {
      if (assessment.totalArBalance + additionalExposure > creditLimit) {
        const behavior = this.appConfig.creditLimitBehavior();
        if (behavior === 'hard') {
          throw new BadRequestException(
            `Order exceeds account credit limit of $${creditLimit.toFixed(2)}. Current AR: $${assessment.totalArBalance.toFixed(2)}`,
          );
        } else {
          this.logger.warn(`Soft Limit Warning for ${account.name}`);
        }
      }
    }
  }

  /**
   * Look up a product from modbm_core.products.
   * Throws BadRequestException if not found.
   * Returns productId and taxCategoryId.
   */
  private async lookupProduct(productId: string): Promise<{
    productId: string;
    salesTaxCategoryId: string | null;
  }> {
    try {
      const product = await this.productsService.findOne(productId);
      return {
        productId: product.productId,
        salesTaxCategoryId: product.salesTaxCategoryId ?? null,
      };
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw new BadRequestException(`Product '${productId}' not found`);
      }
      throw err;
    }
  }

  /**
   * Validate that a product exists in modbm_core.products.
   */
  private async validateProduct(productId: string): Promise<void> {
    await this.lookupProduct(productId);
  }

  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------

  /**
   * Create a new sales order with line items.
   */
  async create(dto: CreateOrderDto, actor: string) {
    const customer = await this.resolveCustomer(dto.customerId);

    // Per-line GST is resolved inside the line loop

    for (const line of dto.lines) {
      if (line.productId) {
        await this.validateProduct(line.productId);
      }
    }

    // Check for duplicate product IDs in the input lines
    // Exemption: The system custom line product can be added multiple times.
    const CUSTOM_LINE_ID = '00000000-0000-0000-0000-000000000000';
    const productIds = dto.lines
      .map((l) => l.productId)
      .filter((id) => id && id !== CUSTOM_LINE_ID);
    const uniqueProductIds = new Set(productIds);
    if (uniqueProductIds.size !== productIds.length) {
      throw new BadRequestException('Order cannot contain duplicate products');
    }

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      // Resolve fulfillmentLocationId: Fall back to system default if omitted
      let fallbackLocId = dto.fulfillmentLocationId;
      if (!fallbackLocId) {
        fallbackLocId =
          this.appConfig.defaultFulfillmentLocationId() ?? undefined;
      }
      if (!fallbackLocId) {
        throw new BadRequestException(
          'Fulfillment location must be provided or configured globally.',
        );
      }

      const orderNumber = await this.generateOrderNumber(tx);
      // Insert order header with snapshotted customer discount + GST category
      const [order] = await tx
        .insert(salesOrders)
        .values({
          orderNumber,
          name: dto.name || orderNumber,
          customerId: dto.customerId,
          customerOrderNumber: dto.customerOrderNumber,
          fulfillmentLocationId: fallbackLocId,
          stateCode: 'draft',
          currencyCode: customer.currencyCode,
          notes: dto.notes,
          createdBy: actor,
        })
        .returning();

      // Insert line items — resolve GST per line (product × customer)
      const lineValues = [];
      for (let idx = 0; idx < dto.lines.length; idx++) {
        const line = dto.lines[idx];
        const lineTax = await this.resolveTaxForLine(
          dto.customerId,
          line.productId,
          line.taxCategoryId,
        );
        const lineDiscount =
          line.discountPercentage ?? customer.customerDiscount;
        const computed = this.computeLineAmount(
          line.quantity,
          line.pricePerUnit,
          lineDiscount,
          lineTax.rate,
        );
        lineValues.push({
          salesOrderId: order.salesOrderId,
          lineNumber: idx + 1,
          productId: line.productId,
          productDescription: line.productDescription,
          quantity: line.quantity,
          pricePerUnit: line.pricePerUnit,
          discountPercentage: lineDiscount,
          taxCategoryId: lineTax.taxCategoryId,
          amount: computed.amount,
          tax: computed.tax,
          totalAmount: computed.totalAmount,
          unitOfMeasure: line.unitOfMeasure,
          fulfillmentLocationId: line.fulfillmentLocationId || fallbackLocId,
        });
      }

      // Assert Credit / State Safety before saving
      let orderTotal = 0;
      lineValues.forEach((lv) => (orderTotal += parseFloat(lv.totalAmount)));
      await this.assertAccountStanding(dto.customerId, orderTotal, 'create');

      if (lineValues.length > 0) {
        await tx.insert(salesOrderLineItems).values(lineValues);
      }

      // Audit + outbox
      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: order.salesOrderId,
        eventType: 'created',
        payload: {
          orderNumber,
          customerId: dto.customerId,
          lineCount: lineValues.length,
        },
        actor,
      });

      return order;
    });

    this.logger.log(
      `Order created: ${result.orderNumber} for customer ${dto.customerId} with ${dto.lines.length} lines by ${actor}`,
    );
    return result;
  }

  /**
   * Update order header fields (name, notes, customer PO).
   */
  async update(id: string, dto: UpdateOrderDto, actor: string) {
    const existing = await this.findOrder(id);

    if (
      existing.stateCode === 'invoiced' ||
      existing.stateCode === 'cancelled'
    ) {
      throw new BadRequestException(
        `Cannot update order in state '${existing.stateCode}'`,
      );
    }

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const audit = calculateAuditTrail(dto, existing, AuditMode.DIFF);

      const [updated] = await tx
        .update(salesOrders)
        .set({
          ...audit.changes,
          modifiedOn: new Date(),
        })
        .where(eq(salesOrders.salesOrderId, id))
        .returning();

      if (audit.hasChanges) {
        await emitEvent(tx, {
          aggregateType: AggregateType.SALES_ORDER,
          aggregateId: id,
          eventType: 'updated',
          payload: {
            changes: audit.changes,
            previousValues: audit.previousValues,
          },
          actor,
        });
      }

      return updated;
    });

    return result;
  }

  /**
   * Transition order state (e.g. draft → quoted → confirmed).
   */
  async changeState(
    id: string,
    newState: string,
    actor: string,
    generateBackorders?: boolean,
  ) {
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

    // Gate: picking → shipped requires all lines fully shipped
    if (existing.stateCode === 'picking' && newState === 'shipped') {
      await this.pickingService.assertFullyShipped(id);
    }

    const orderLines = await this.db
      .select()
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, id));

    // Assert Credit / State Safety for forward progressions
    if (
      newState === 'confirmed' ||
      newState === 'allocated' ||
      newState === 'picking'
    ) {
      if (!existing.customerId) {
        throw new BadRequestException(
          'Order must have a customer to be confirmed',
        );
      }
      let orderTotal = 0;
      orderLines.forEach((lv) => {
        if (lv.totalAmount) orderTotal += parseFloat(lv.totalAmount);
      });
      // A status change to confirmed or allocated constitutes a review process, so operation='confirm' will trigger the checks
      await this.assertAccountStanding(
        existing.customerId,
        orderTotal,
        'confirm',
      );
    }

    // INVENTORY GAP CHECK - Ensure we evaluate backorders upon Sales confirmation
    let gaps: InventoryGap[] = [];
    if (newState === 'confirmed') {
      gaps = await this.backordersService.evaluateGaps(id);

      if (gaps.length > 0 && generateBackorders === undefined) {
        throw new HttpException(
          {
            statusCode: HttpStatus.CONFLICT,
            message: 'INVENTORY_GAP',
            gaps,
          },
          HttpStatus.CONFLICT,
        );
      }
    }

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      if (
        newState === 'confirmed' &&
        generateBackorders === true &&
        gaps.length > 0
      ) {
        await this.backordersService.generateDemand(id, gaps, actor, tx);
      }
      if (newState === 'cancelled') {
        await tx
          .update(backorders)
          .set({ stateCode: 'cancelled', modifiedOn: new Date() })
          .where(eq(backorders.salesOrderId, id));
      }

      const [updated] = await tx
        .update(salesOrders)
        .set({ stateCode: newState, modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, id))
        .returning();

      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: id,
        eventType: 'status_changed',
        payload: {
          from: existing.stateCode,
          to: newState,
        },
        actor,
      });

      return updated;
    });

    this.logger.log(
      `Order ${existing.orderNumber} state: ${existing.stateCode} → ${newState} by ${actor}`,
    );
    return result;
  }

  /**
   * Archive an order.
   */
  async archive(id: string, actor: string) {
    const existing = await this.findOrder(id);

    if (
      existing.stateCode !== 'invoiced' &&
      existing.stateCode !== 'cancelled'
    ) {
      throw new BadRequestException(
        `Order must be 'invoiced' or 'cancelled' to be archived (current state: '${existing.stateCode}')`,
      );
    }

    return await this.db.transaction(async (tx: DrizzleDB) => {
      const [updated] = await tx
        .update(salesOrders)
        .set({ stateCode: 'archived', modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, id))
        .returning();

      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
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
   * Unarchive an order.
   */
  async unarchive(id: string, actor: string) {
    const existing = await this.findOrder(id);

    if (existing.stateCode !== 'archived') {
      throw new BadRequestException(`Order is not archived`);
    }

    const lastEvent = await this.db
      .select()
      .from(orderEvents)
      .where(
        sql`${orderEvents.salesOrderId} = ${id} AND ${orderEvents.eventType} = 'archived'`,
      )
      .orderBy(sql`${orderEvents.createdOn} DESC`)
      .limit(1);

    const previousState =
      ((lastEvent[0]?.payload as Record<string, unknown>)?.from as string) ||
      'cancelled';

    return await this.db.transaction(async (tx: DrizzleDB) => {
      const [updated] = await tx
        .update(salesOrders)
        .set({ stateCode: previousState, modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, id))
        .returning();

      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: id,
        eventType: 'unarchived',
        payload: {
          from: 'archived',
          to: previousState,
        },
        actor,
      });

      return updated;
    });
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

    const CUSTOM_LINE_ID = '00000000-0000-0000-0000-000000000000';
    if (dto.productId) {
      await this.validateProduct(dto.productId);

      // Check if product already exists in this order (exempting Custom Lines)
      if (dto.productId !== CUSTOM_LINE_ID) {
        const existingLine = await this.db
          .select({ id: salesOrderLineItems.salesOrderLineId })
          .from(salesOrderLineItems)
          .where(
            sql`${salesOrderLineItems.salesOrderId} = ${orderId} AND ${salesOrderLineItems.productId} = ${dto.productId}`,
          )
          .limit(1);

        if (existingLine.length > 0) {
          throw new BadRequestException(
            `Product '${dto.productId}' is already present in this order.`,
          );
        }
      }
    }

    // Get next line number
    const maxLine = await this.db
      .select({
        max: sql<number>`COALESCE(MAX(${salesOrderLineItems.lineNumber}), 0)`,
      })
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, orderId));

    const lineNumber = (maxLine[0]?.max ?? 0) + 1;

    // Resolve GST: product × customer intersection, with per-line override
    const lineTax = await this.resolveTaxForLine(
      order.customerId ?? '',
      dto.productId,
      dto.taxCategoryId,
    );
    const taxCategoryId = lineTax.taxCategoryId;
    const taxRate = lineTax.rate;

    const customer = await this.resolveCustomer(order.customerId ?? '');
    const lineDiscount =
      dto.discountPercentage ?? customer.customerDiscount ?? '0';

    const computed = this.computeLineAmount(
      dto.quantity,
      dto.pricePerUnit,
      lineDiscount,
      taxRate,
    );

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
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
          taxCategoryId,
          amount: computed.amount,
          tax: computed.tax,
          totalAmount: computed.totalAmount,
          unitOfMeasure: dto.unitOfMeasure,
          fulfillmentLocationId: order.fulfillmentLocationId,
        })
        .returning();

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: orderId,
        eventType: 'line_added',
        payload: {
          lineId: line.salesOrderLineId,
          productId: dto.productId,
          quantity: dto.quantity,
          taxCategoryId,
        },
        actor,
      });

      return line;
    });

    return result;
  }

  /**
   * Add a line item post-confirmation explicitly natively without state locking.
   */
  async addPostConfirmationLine(
    orderId: string,
    dto: AddLineDto,
    actor: string,
  ) {
    const order = await this.findOrder(orderId);

    if (['invoiced', 'cancelled'].includes(order.stateCode)) {
      throw new BadRequestException(
        `Cannot add post-confirmation lines to order in state '${order.stateCode}'`,
      );
    }

    const CUSTOM_LINE_ID = '00000000-0000-0000-0000-000000000000';
    if (dto.productId) {
      await this.validateProduct(dto.productId);

      // Check if product already exists in this order (exempting Custom Lines)
      if (dto.productId !== CUSTOM_LINE_ID) {
        const existingLine = await this.db
          .select({ id: salesOrderLineItems.salesOrderLineId })
          .from(salesOrderLineItems)
          .where(
            sql`${salesOrderLineItems.salesOrderId} = ${orderId} AND ${salesOrderLineItems.productId} = ${dto.productId}`,
          )
          .limit(1);

        if (existingLine.length > 0) {
          throw new BadRequestException(
            `Product '${dto.productId}' is already present in this order.`,
          );
        }
      }
    }

    // Get next line number
    const maxLine = await this.db
      .select({
        max: sql<number>`COALESCE(MAX(${salesOrderLineItems.lineNumber}), 0)`,
      })
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, orderId));

    const lineNumber = (maxLine[0]?.max ?? 0) + 1;

    // Resolve GST: product × customer intersection, with per-line override
    const lineTax = await this.resolveTaxForLine(
      order.customerId ?? '',
      dto.productId,
      dto.taxCategoryId,
    );
    const taxCategoryId = lineTax.taxCategoryId;
    const taxRate = lineTax.rate;

    const customer = await this.resolveCustomer(order.customerId ?? '');
    const lineDiscount =
      dto.discountPercentage ?? customer.customerDiscount ?? '0';

    const computed = this.computeLineAmount(
      dto.quantity,
      dto.pricePerUnit,
      lineDiscount,
      taxRate,
    );

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
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
          taxCategoryId,
          amount: computed.amount,
          tax: computed.tax,
          totalAmount: computed.totalAmount,
          unitOfMeasure: dto.unitOfMeasure,
          fulfillmentLocationId: order.fulfillmentLocationId,
          isPostConfirmation: true,
        })
        .returning();

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: orderId,
        eventType: 'post_confirmation_line_added',
        payload: {
          lineId: line.salesOrderLineId,
          productId: dto.productId,
          quantity: dto.quantity,
          taxCategoryId,
          pricePerUnit: dto.pricePerUnit,
        },
        actor,
      });

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
    const existingLine = await this.findLine(lineId, orderId);

    if (['invoiced', 'shipped', 'cancelled'].includes(order.stateCode)) {
      const isPostConfLine = existingLine.isPostConfirmation === true;
      if (
        !isPostConfLine ||
        ['invoiced', 'cancelled'].includes(order.stateCode)
      ) {
        throw new BadRequestException(
          `Cannot update normal lines on order in state '${order.stateCode}'`,
        );
      }
    }

    // Resolve GST: DTO override → existing line category → default product/customer resolution
    let taxCategoryId = existingLine.taxCategoryId;
    let taxRate = 0;

    if (dto.taxCategoryId) {
      // 1. Explicit override via DTO
      const cat = await this.taxService.getById(dto.taxCategoryId);
      taxCategoryId = cat.taxCategoryId;
      taxRate = parseFloat(cat.rate ?? '0');
    } else if (taxCategoryId) {
      // 2. Keep existing line category
      const cat = await this.taxService.getById(taxCategoryId);
      taxRate = parseFloat(cat.rate ?? '0');
    } else {
      // 3. Re-resolve dynamically from product x customer rules
      const resolved = await this.resolveTaxForLine(
        order.customerId ?? '',
        existingLine.productId ?? undefined,
      );
      taxCategoryId = resolved.taxCategoryId;
      taxRate = resolved.rate;
    }

    const quantity = dto.quantity ?? existingLine.quantity;
    const pricePerUnit = dto.pricePerUnit ?? existingLine.pricePerUnit;
    const discountPercentage =
      dto.discountPercentage ?? existingLine.discountPercentage ?? '0';

    const computed = this.computeLineAmount(
      quantity,
      pricePerUnit,
      discountPercentage,
      taxRate,
    );

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const audit = calculateAuditTrail(dto, existingLine, AuditMode.DIFF);

      const [updated] = await tx
        .update(salesOrderLineItems)
        .set({
          ...audit.changes,
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

      if (audit.hasChanges) {
        await emitEvent(tx, {
          aggregateType: AggregateType.SALES_ORDER,
          aggregateId: orderId,
          eventType: 'line_updated',
          payload: {
            lineId,
            changes: audit.changes,
            previousValues: audit.previousValues,
          },
          actor,
        });
      }

      return updated;
    });

    return result;
  }

  /**
   * Remove a line item.
   */
  async removeLine(orderId: string, lineId: string, actor: string) {
    const order = await this.findOrder(orderId);
    const existingLine = await this.findLine(lineId, orderId);

    if (['invoiced', 'shipped', 'cancelled'].includes(order.stateCode)) {
      const isPostConfLine = existingLine.isPostConfirmation === true;
      if (
        !isPostConfLine ||
        ['invoiced', 'cancelled'].includes(order.stateCode)
      ) {
        throw new BadRequestException(
          `Cannot remove normal lines from order in state '${order.stateCode}'`,
        );
      }
    }

    await this.db.transaction(async (tx: DrizzleDB) => {
      // Delete associated demand records
      await tx
        .delete(backorders)
        .where(eq(backorders.salesOrderLineId, lineId));

      await tx
        .delete(salesOrderLineItems)
        .where(eq(salesOrderLineItems.salesOrderLineId, lineId));

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: orderId,
        eventType: 'line_removed',
        payload: {
          lineId,
          productId: existingLine.productId,
          quantity: existingLine.quantity,
        },
        actor,
      });
    });
  }

  /**
   * Get a single order with its line items and events.
   */
  async findOne(id: string) {
    const order = await this.findOrder(id);

    const lines = await this.db
      .select({
        salesOrderLineId: salesOrderLineItems.salesOrderLineId,
        salesOrderId: salesOrderLineItems.salesOrderId,
        lineNumber: salesOrderLineItems.lineNumber,
        productId: salesOrderLineItems.productId,
        productNumber: coreProducts.productNumber,
        productType: coreProducts.productType,
        productDescription: salesOrderLineItems.productDescription,
        quantity: salesOrderLineItems.quantity,
        pricePerUnit: salesOrderLineItems.pricePerUnit,
        discountPercentage: salesOrderLineItems.discountPercentage,
        amount: salesOrderLineItems.amount,
        tax: salesOrderLineItems.tax,
        totalAmount: salesOrderLineItems.totalAmount,
        unitOfMeasure: salesOrderLineItems.unitOfMeasure,
        quantityPicked: salesOrderLineItems.quantityPicked,
        taxCategoryId: salesOrderLineItems.taxCategoryId,
        fulfillmentLocationId: salesOrderLineItems.fulfillmentLocationId,
        isPostConfirmation: salesOrderLineItems.isPostConfirmation,
        baseUom: coreProducts.baseUom,
      })
      .from(salesOrderLineItems)
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .where(eq(salesOrderLineItems.salesOrderId, id))
      .orderBy(salesOrderLineItems.lineNumber);

    const productIds = Array.from(
      new Set(
        lines
          .map((l) => l.productId)
          .filter(
            (id): id is string =>
              id !== null && id !== '00000000-0000-0000-0000-000000000000',
          ),
      ),
    );

    let allUoms: any[] = [];
    if (productIds.length > 0) {
      allUoms = await this.db
        .select()
        .from(productUoms)
        .where(inArray(productUoms.productId, productIds));
    }

    const linesWithUoms = lines.map((line) => {
      return {
        ...line,
        productUoms: allUoms.filter((u) => u.productId === line.productId),
      };
    });

    const events = await this.db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.salesOrderId, id))
      .orderBy(orderEvents.createdOn);

    const backorderList = await this.db
      .select({
        lineNumber: salesOrderLineItems.lineNumber,
        productId: backorders.productId,
        productNumber: coreProducts.productNumber,
        quantity: backorders.quantity,
        stateCode: backorders.stateCode,
        purchaseOrderId: backorders.purchaseOrderId,
        purchaseOrderNumber: purchaseOrders.orderNumber,
        purchaseOrderState: purchaseOrders.stateCode,
        createdOn: backorders.createdOn,
      })
      .from(backorders)
      .leftJoin(coreProducts, eq(backorders.productId, coreProducts.productId))
      .leftJoin(
        purchaseOrders,
        eq(backorders.purchaseOrderId, purchaseOrders.purchaseOrderId),
      )
      .leftJoin(
        salesOrderLineItems,
        eq(backorders.salesOrderLineId, salesOrderLineItems.salesOrderLineId),
      )
      .where(eq(backorders.salesOrderId, order.salesOrderId))
      .orderBy(salesOrderLineItems.lineNumber, backorders.createdOn);

    return {
      ...order,
      lines: linesWithUoms,
      events,
      backorders: backorderList,
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async findOrder(id: string) {
    if (!id || id === 'undefined') {
      throw new BadRequestException(`Invalid order ID: ${id}`);
    }

    // sales_order_id is uuid — reject non-UUID strings early
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    if (!isUuid) {
      throw new NotFoundException(`Order '${id}' not found`);
    }

    const rows = await this.db
      .select({
        order: salesOrders,
        customerName: coreAccounts.name,
      })
      .from(salesOrders)
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.accountId),
      )
      .where(eq(salesOrders.salesOrderId, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Order '${id}' not found`);
    }
    return { ...rows[0].order, customerName: rows[0].customerName };
  }

  private async findLine(lineId: string, orderId: string) {
    return sharedFindOrderLine(this.db, lineId, orderId);
  }
}

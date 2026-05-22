import { HttpException, HttpStatus } from '@nestjs/common';
import { BackordersService } from './backorders.service';
import { InventoryGap, SALES_ORDER_STATE, CUSTOMER_STATE } from '@modbm/shared';
import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, sql, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { AppConfigService } from '../settings/app-config.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderLineItems,
  orderEvents,
  customers as coreAccounts,
  products as coreProducts,
  backorders,
  purchaseOrders,
  locations,
  productUoms,
  productComponents,
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
import { AggregateType, EventType } from '../common/event-types';

import { TaxCategoriesService } from '../tax/tax-categories.service';
import { PickingService } from './picking.service';
import { InventoryService } from '../inventory/inventory.service';
import { AccountsService } from '../customers/customers.service';
import { CreditAssessmentService } from '../customers/credit-assessment.service';
import { ProductsService } from '../products/products.service';
import {
  SALES_ORDER_TRANSITIONS as STATE_TRANSITIONS,
  getValidStates,
  computeLinePriceForStorage,
} from '@modbm/shared';
import {
  resolveEffectiveCreditHold,
  resolveEffectiveCreditLimit,
} from '../customers/credit-control.utils';

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
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const prefix = `ORD-${today}-`;

    // Find the highest sequence for today, locking the row to prevent races
    const rows = await db
      .select({ order_number: salesOrders.orderNumber })
      .from(salesOrders)
      .where(sql`${salesOrders.orderNumber} LIKE ${prefix + '%'}`)
      .orderBy(sql`${salesOrders.orderNumber} DESC`)
      .limit(1);

    const lastNumber = rows[0]?.order_number;
    let nextSeq = 1;
    if (lastNumber) {
      const parts = lastNumber.split('-');
      const seqStr = parts[parts.length - 1];
      nextSeq = parseInt(seqStr, 10) + 1;
    }

    const nextNumber = `${prefix}${nextSeq.toString().padStart(4, '0')}`;
    return nextNumber;
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
    tx?: DrizzleDB,
  ): Promise<{ taxCategoryId: string; rate: number }> {
    // 1. Explicit override wins
    if (taxCategoryIdOverride) {
      const cat = await this.taxService.getById(taxCategoryIdOverride, tx);
      return {
        taxCategoryId: cat.taxCategoryId,
        rate: parseFloat(cat.rate ?? '0'),
      };
    }

    // 2. Customer exempt → always 0%
    const customer = await this.accountsService.findOne(customerId, tx);

    if (customer.taxCategoryId) {
      const acctCat = await this.taxService.getById(customer.taxCategoryId, tx);
      if (acctCat.code === 'EXE' || acctCat.type === 'exempt') {
        return {
          taxCategoryId: acctCat.taxCategoryId,
          rate: parseFloat(acctCat.rate ?? '0'),
        };
      }
    }

    // 3. Product's GST category
    if (productId) {
      const product = await this.lookupProduct(productId, tx);
      if (product.salesTaxCategoryId) {
        try {
          const cat = await this.taxService.getById(
            product.salesTaxCategoryId,
            tx,
          );
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
    const defaultGst = await this.taxService.getDefault(tx);
    return {
      taxCategoryId: defaultGst.taxCategoryId,
      rate: parseFloat(defaultGst.rate ?? '0'),
    };
  }

  /**
   * Resolve a customer from modbm_core.customers.
   * Throws BadRequestException if not found.
   * Returns the currency code. Discount resolution is now handled
   * by the frontend via the discount_matrix; backend trusts posted values.
   */
  private async resolveCustomer(
    customerId: string,
    tx?: DrizzleDB,
  ): Promise<{
    currencyCode: string;
  }> {
    try {
      const customer = await this.accountsService.findOne(customerId, tx);
      return {
        currencyCode: customer.currencyCode ?? 'EUR',
      };
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw new BadRequestException(`Customer '${customerId}' not found`);
      }
      throw err;
    }
  }

  /**
   * Asserts that an customer is valid for ordering.
   * Checks state, credit hold, and credit limit.
   */
  private async assertAccountStanding(
    customerId: string,
    additionalExposure: number,
    operation: 'create' | 'update' | 'confirm',
    tx?: DrizzleDB,
  ): Promise<void> {
    const customer = await this.accountsService.findOne(customerId, tx);

    // 1. Strict State Block
    if (
      customer.stateCode === CUSTOMER_STATE.INACTIVE ||
      customer.stateCode === CUSTOMER_STATE.ARCHIVED
    ) {
      throw new BadRequestException(
        `Cannot ${operation} order: Customer '${customer.name}' is ${customer.stateCode}.`,
      );
    }

    // 2. Credit Hold Status
    const isHold = resolveEffectiveCreditHold({
      creditLimit: customer.creditLimit,
      isOnCreditHold: customer.isOnCreditHold,
      tradingTermsId: customer.tradingTermsId,
      accountGroup: {
        creditLimit: (customer as any).accountGroupCreditLimit,
        isOnCreditHold: (customer as any).accountGroupIsOnCreditHold,
        tradingTermsId: (customer as any).accountGroupTradingTermsId,
      },
    });

    if (isHold && (operation === 'confirm' || operation === 'update')) {
      throw new BadRequestException(
        `Cannot ${operation} order: Customer '${customer.name}' is on strict Credit Hold.`,
      );
    }

    // 3. Credit Assessment (Limits and Overdue)
    const assessment = await this.creditAssessmentService.assessCredit(
      customerId,
      tx,
    );

    if (assessment.isOverdue && operation === 'confirm') {
      throw new BadRequestException(
        `Cannot confirm order: Customer has $${assessment.overdueBalance.toFixed(2)} in overdue balances.`,
      );
    }

    const limitStr = resolveEffectiveCreditLimit({
      creditLimit: customer.creditLimit,
      isOnCreditHold: customer.isOnCreditHold,
      tradingTermsId: customer.tradingTermsId,
      accountGroup: {
        creditLimit: (customer as any).accountGroupCreditLimit,
        isOnCreditHold: (customer as any).accountGroupIsOnCreditHold,
        tradingTermsId: (customer as any).accountGroupTradingTermsId,
      },
    });

    const creditLimit = parseFloat(limitStr);

    // If limits apply, check exposure
    if (creditLimit >= 0) {
      if (assessment.totalArBalance + additionalExposure > creditLimit) {
        const behavior = this.appConfig.creditLimitBehavior();
        if (behavior === 'hard') {
          throw new BadRequestException(
            `Order exceeds customer credit limit of $${creditLimit.toFixed(2)}. Current AR: $${assessment.totalArBalance.toFixed(2)}`,
          );
        } else {
          this.logger.warn(`Soft Limit Warning for ${customer.name}`);
        }
      }
    }
  }

  /**
   * Look up a product from modbm_core.products.
   * Throws BadRequestException if not found.
   * Returns productId, taxCategoryId, productType, and listPrice.
   */
  private async lookupProduct(
    productId: string,
    tx?: DrizzleDB,
  ): Promise<{
    productId: string;
    salesTaxCategoryId: string | null;
    productType: string;
    structureType: string;
    listPrice: string;
  }> {
    try {
      const product = await this.productsService.findOne(productId, tx);
      return {
        productId: product.productId,
        salesTaxCategoryId: product.salesTaxCategoryId ?? null,
        productType: product.productType ?? 'inventory',
        structureType: (product as any).structureType ?? 'standard',
        listPrice: product.listPrice ?? '0',
      };
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw new BadRequestException(`Product '${productId}' not found`);
      }
      throw err;
    }
  }

  /**
   * Fetch components for a kit parent product.
   */
  private async getKitComponents(productId: string, tx: DrizzleDB) {
    return await tx
      .select({
        componentId: productComponents.componentId,
        parentProductId: productComponents.parentProductId,
        childProductId: productComponents.childProductId,
        quantity: productComponents.quantity,
        parentQuantity: productComponents.parentQuantity,
        sequenceNumber: productComponents.sequenceNumber,
        fractionalBehavior: productComponents.fractionalBehavior,
        productType: coreProducts.productType,
        name: coreProducts.name,
        baseUom: coreProducts.baseUom,
        listPrice: coreProducts.listPrice,
        salesTaxCategoryId: coreProducts.salesTaxCategoryId,
      })
      .from(productComponents)
      .innerJoin(
        coreProducts,
        eq(productComponents.childProductId, coreProducts.productId),
      )
      .where(eq(productComponents.parentProductId, productId))
      .orderBy(productComponents.sequenceNumber);
  }

  private calculateComponentQuantity(
    orderQuantity: string,
    componentQuantity: string,
    parentQuantity: string,
    fractionalBehavior: string,
    productId: string,
  ): string {
    const oq = parseFloat(orderQuantity);
    const pq = parseFloat(parentQuantity || '1');
    const cq = parseFloat(componentQuantity);

    if (fractionalBehavior === 'force_multiple') {
      if (oq % pq !== 0) {
        throw new BadRequestException(
          `Order quantity for kit ${productId} must be a multiple of ${pq}`,
        );
      }
    }

    let rawQty = (oq / pq) * cq;

    if (fractionalBehavior === 'round_up') {
      rawQty = Math.ceil(rawQty);
    } else if (fractionalBehavior === 'round_down') {
      rawQty = Math.floor(rawQty);
    }

    return rawQty.toString();
  }

  /**
   * Validate that a product exists in modbm_core.products.
   */
  private async validateProduct(
    productId: string,
    tx?: DrizzleDB,
  ): Promise<void> {
    await this.lookupProduct(productId, tx);
  }

  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------

  /**
   * Create a new sales order with line items.
   */
  async create(dto: CreateOrderDto, actor: string) {
    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const customer = await this.resolveCustomer(dto.customerId, tx);

      for (const line of dto.lines) {
        if (line.productId) {
          await this.validateProduct(line.productId, tx);
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
        throw new BadRequestException(
          'Order cannot contain duplicate products',
        );
      }

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
          stateCode: SALES_ORDER_STATE.DRAFT,
          currencyCode: customer.currencyCode,
          notes: dto.notes,
          createdBy: actor,
        })
        .returning();

      // Insert line items — resolve GST per line (product × customer)
      const lineValues: any[] = [];
      let currentLineNumber = 1;
      for (let idx = 0; idx < dto.lines.length; idx++) {
        const line = dto.lines[idx];
        const lineTax = await this.resolveTaxForLine(
          dto.customerId,
          line.productId,
          line.taxCategoryId,
          tx,
        );
        const lineDiscount = line.discountPercentage ?? '0';

        let isKit = false;
        const parentPrice = parseFloat(line.pricePerUnit || '0');
        if (line.productId) {
          const prodInfo = await this.lookupProduct(line.productId, tx);
          if (prodInfo.structureType === 'kit') {
            isKit = true;
          }
        }

        const parentLineId = randomUUID();

        if (isKit) {
          const parentPriceToUse =
            parentPrice > 0 ? parentPrice.toString() : '0';
          const parentComputed = this.computeLineAmount(
            line.quantity,
            parentPriceToUse,
            lineDiscount,
            lineTax.rate,
          );

          lineValues.push({
            salesOrderLineId: parentLineId,
            salesOrderId: order.salesOrderId,
            lineNumber: currentLineNumber++,
            productId: line.productId,
            productDescription: line.productDescription,
            quantity: line.quantity,
            pricePerUnit: parentPriceToUse,
            discountPercentage: lineDiscount,
            taxCategoryId: lineTax.taxCategoryId,
            amount: parentComputed.amount,
            tax: parentComputed.tax,
            totalAmount: parentComputed.totalAmount,
            unitOfMeasure: line.unitOfMeasure,
            fulfillmentLocationId: line.fulfillmentLocationId || fallbackLocId,
            parentLineId: null,
          });

          const components = await this.getKitComponents(line.productId!, tx);
          for (const comp of components) {
            const compTax = await this.resolveTaxForLine(
              dto.customerId,
              comp.childProductId,
              undefined,
              tx,
            );

            const childQtyStr = this.calculateComponentQuantity(
              line.quantity,
              comp.quantity,
              comp.parentQuantity || '1',
              comp.fractionalBehavior || 'allow_fractional',
              line.productId!
            );

            let childPrice = '0';
            if (parentPrice <= 0) {
              childPrice = comp.listPrice || '0';
            }

            const childComputed = this.computeLineAmount(
              childQtyStr,
              childPrice,
              '0',
              compTax.rate,
            );

            lineValues.push({
              salesOrderLineId: randomUUID(),
              salesOrderId: order.salesOrderId,
              lineNumber: currentLineNumber++,
              productId: comp.childProductId,
              productDescription: comp.name,
              quantity: childQtyStr,
              pricePerUnit: childPrice,
              discountPercentage: '0',
              taxCategoryId: compTax.taxCategoryId,
              amount: childComputed.amount,
              tax: childComputed.tax,
              totalAmount: childComputed.totalAmount,
              unitOfMeasure: comp.baseUom || 'EA',
              fulfillmentLocationId:
                line.fulfillmentLocationId || fallbackLocId,
              parentLineId: parentLineId,
            });
          }
        } else {
          const computed = this.computeLineAmount(
            line.quantity,
            line.pricePerUnit,
            lineDiscount,
            lineTax.rate,
          );
          lineValues.push({
            salesOrderLineId: parentLineId,
            salesOrderId: order.salesOrderId,
            lineNumber: currentLineNumber++,
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
            parentLineId: null,
          });
        }
      }

      // Assert Credit / State Safety before saving
      let orderTotal = 0;
      lineValues.forEach((lv) => (orderTotal += parseFloat(lv.totalAmount)));
      await this.assertAccountStanding(
        dto.customerId,
        orderTotal,
        'create',
        tx,
      );

      if (lineValues.length > 0) {
        await tx.insert(salesOrderLineItems).values(lineValues);
      }

      // Audit + outbox
      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: order.salesOrderId,
        eventType: EventType.CREATED,
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
      existing.stateCode === SALES_ORDER_STATE.INVOICED ||
      existing.stateCode === SALES_ORDER_STATE.CANCELLED
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
          eventType: EventType.UPDATED,
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
  async changeSalesOrderState(
    id: string,
    newState: string,
    actor: string,
    generateBackorders?: boolean,
    discrepanciesAcknowledged?: boolean,
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
    if (
      existing.stateCode === SALES_ORDER_STATE.PICKING &&
      newState === SALES_ORDER_STATE.SHIPPED
    ) {
      await this.pickingService.assertFullyShipped(id);
    }

    const orderLines = await this.db
      .select()
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, id));

    // Assert Credit / State Safety for forward progressions
    if (
      newState === SALES_ORDER_STATE.CONFIRMED ||
      newState === ('allocated' as any) ||
      newState === SALES_ORDER_STATE.PICKING
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
    if (newState === SALES_ORDER_STATE.CONFIRMED) {
      gaps = await this.backordersService.evaluateGaps(id);

      if (
        gaps.length > 0 &&
        !discrepanciesAcknowledged &&
        generateBackorders === undefined
      ) {
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
        newState === SALES_ORDER_STATE.CONFIRMED &&
        generateBackorders === true &&
        gaps.length > 0
      ) {
        await this.backordersService.generateDemand(id, gaps, actor, tx);
      }
      if (newState === SALES_ORDER_STATE.CANCELLED) {
        await tx
          .update(backorders)
          .set({
            stateCode: SALES_ORDER_STATE.CANCELLED as any,
            modifiedOn: new Date(),
          })
          .where(eq(backorders.salesOrderId, id));
      }

      const [updated] = await tx
        .update(salesOrders)
        .set({
          stateCode: newState as any,
          discrepanciesAcknowledged:
            discrepanciesAcknowledged !== undefined
              ? discrepanciesAcknowledged
              : undefined,
          modifiedOn: new Date(),
        })
        .where(eq(salesOrders.salesOrderId, id))
        .returning();

      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: id,
        eventType: EventType.STATUS_CHANGED,
        payload: {
          from: existing.stateCode,
          to: newState,
          discrepanciesAcknowledged,
        },
        actor,
      });

      return updated;
    });

    this.logger.log(
      `Order ${existing.orderNumber} state: ${existing.stateCode} → ${newState} by ${actor}`,
    );

    if (
      newState === SALES_ORDER_STATE.CONFIRMED &&
      generateBackorders === true &&
      gaps.length > 0
    ) {
      await this.backordersService.resolveOpenDemands(actor);
    }

    return result;
  }

  /**
   * Archive an order.
   */
  async archive(id: string, actor: string) {
    const existing = await this.findOrder(id);

    if (
      existing.stateCode !== SALES_ORDER_STATE.INVOICED &&
      existing.stateCode !== SALES_ORDER_STATE.CANCELLED
    ) {
      throw new BadRequestException(
        `Order must be '${SALES_ORDER_STATE.INVOICED}' or '${SALES_ORDER_STATE.CANCELLED}' to be archived (current state: '${existing.stateCode}')`,
      );
    }

    return await this.changeSalesOrderState(
      id,
      SALES_ORDER_STATE.ARCHIVED,
      actor,
    );
  }

  /**
   * Unarchive an order.
   */
  async unarchive(id: string, actor: string) {
    const existing = await this.findOrder(id);

    if (existing.stateCode !== SALES_ORDER_STATE.ARCHIVED) {
      throw new BadRequestException(`Order is not archived`);
    }

    const lastEvent = await this.db
      .select()
      .from(orderEvents)
      .where(
        sql`${orderEvents.salesOrderId} = ${id} AND ${orderEvents.eventType} = ${EventType.ARCHIVED}`,
      )
      .orderBy(sql`${orderEvents.createdOn} DESC`)
      .limit(1);

    const previousState =
      ((lastEvent[0]?.payload as Record<string, unknown>)?.from as string) ||
      (SALES_ORDER_STATE.CANCELLED as any);

    return await this.changeSalesOrderState(id, previousState, actor);
  }

  /**
   * Add a line item to an existing order.
   */
  async addLine(orderId: string, dto: AddLineDto, actor: string) {
    const order = await this.findOrder(orderId);

    if (
      [
        SALES_ORDER_STATE.INVOICED,
        SALES_ORDER_STATE.SHIPPED,
        SALES_ORDER_STATE.CANCELLED,
      ].includes(order.stateCode as any)
    ) {
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

    let currentLineNumber = (maxLine[0]?.max ?? 0) + 1;

    // Resolve GST: product × customer intersection, with per-line override
    const lineTax = await this.resolveTaxForLine(
      order.customerId ?? '',
      dto.productId,
      dto.taxCategoryId,
    );
    const taxCategoryId = lineTax.taxCategoryId;
    const taxRate = lineTax.rate;

    const lineDiscount = dto.discountPercentage ?? '0';

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      let isKit = false;
      const parentPrice = parseFloat(dto.pricePerUnit || '0');
      if (dto.productId) {
        const prodInfo = await this.lookupProduct(dto.productId, tx);
        if (prodInfo.structureType === 'kit') {
          isKit = true;
        }
      }

      const parentLineId = randomUUID();
      const insertValues: any[] = [];
      let parentLine: any = null;

      if (isKit) {
        const parentPriceToUse = parentPrice > 0 ? parentPrice.toString() : '0';
        const parentComputed = this.computeLineAmount(
          dto.quantity,
          parentPriceToUse,
          lineDiscount,
          taxRate,
        );

        parentLine = {
          salesOrderLineId: parentLineId,
          salesOrderId: orderId,
          lineNumber: currentLineNumber++,
          productId: dto.productId,
          productDescription: dto.productDescription,
          quantity: dto.quantity,
          pricePerUnit: parentPriceToUse,
          discountPercentage: lineDiscount,
          taxCategoryId,
          amount: parentComputed.amount,
          tax: parentComputed.tax,
          totalAmount: parentComputed.totalAmount,
          unitOfMeasure: dto.unitOfMeasure,
          fulfillmentLocationId: order.fulfillmentLocationId,
          parentLineId: null,
        };
        insertValues.push(parentLine);

        const components = await this.getKitComponents(dto.productId!, tx);
        for (const comp of components) {
          const compTax = await this.resolveTaxForLine(
            order.customerId ?? '',
            comp.childProductId,
            undefined,
            tx,
          );

          const childQtyStr = this.calculateComponentQuantity(
            dto.quantity,
            comp.quantity,
            comp.parentQuantity || '1',
            comp.fractionalBehavior || 'allow_fractional',
            dto.productId!
          );

          let childPrice = '0';
          if (parentPrice <= 0) {
            childPrice = comp.listPrice || '0';
          }

          const childComputed = this.computeLineAmount(
            childQtyStr,
            childPrice,
            '0',
            compTax.rate,
          );

          insertValues.push({
            salesOrderLineId: randomUUID(),
            salesOrderId: orderId,
            lineNumber: currentLineNumber++,
            productId: comp.childProductId,
            productDescription: comp.name,
            quantity: childQtyStr,
            pricePerUnit: childPrice,
            discountPercentage: '0',
            taxCategoryId: compTax.taxCategoryId,
            amount: childComputed.amount,
            tax: childComputed.tax,
            totalAmount: childComputed.totalAmount,
            unitOfMeasure: comp.baseUom || 'EA',
            fulfillmentLocationId: order.fulfillmentLocationId,
            parentLineId: parentLineId,
          });
        }
      } else {
        const computed = this.computeLineAmount(
          dto.quantity,
          dto.pricePerUnit,
          lineDiscount,
          taxRate,
        );

        parentLine = {
          salesOrderLineId: parentLineId,
          salesOrderId: orderId,
          lineNumber: currentLineNumber++,
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
          parentLineId: null,
        };
        insertValues.push(parentLine);
      }

      await tx.insert(salesOrderLineItems).values(insertValues);

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: orderId,
        eventType: EventType.LINE_ADDED,
        payload: {
          lineId: parentLineId,
          productId: dto.productId,
          quantity: dto.quantity,
          taxCategoryId,
        },
        actor,
      });

      return parentLine;
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

    if (
      [SALES_ORDER_STATE.INVOICED, SALES_ORDER_STATE.CANCELLED].includes(
        order.stateCode as any,
      )
    ) {
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

    let currentLineNumber = (maxLine[0]?.max ?? 0) + 1;

    // Resolve GST: product × customer intersection, with per-line override
    const lineTax = await this.resolveTaxForLine(
      order.customerId ?? '',
      dto.productId,
      dto.taxCategoryId,
    );
    const taxCategoryId = lineTax.taxCategoryId;
    const taxRate = lineTax.rate;

    const lineDiscount = dto.discountPercentage ?? '0';

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      let isKit = false;
      const parentPrice = parseFloat(dto.pricePerUnit || '0');
      if (dto.productId) {
        const prodInfo = await this.lookupProduct(dto.productId, tx);
        if (prodInfo.structureType === 'kit') {
          isKit = true;
        }
      }

      const parentLineId = randomUUID();
      const insertValues: any[] = [];
      let parentLine: any = null;

      if (isKit) {
        const parentPriceToUse = parentPrice > 0 ? parentPrice.toString() : '0';
        const parentComputed = this.computeLineAmount(
          dto.quantity,
          parentPriceToUse,
          lineDiscount,
          taxRate,
        );

        parentLine = {
          salesOrderLineId: parentLineId,
          salesOrderId: orderId,
          lineNumber: currentLineNumber++,
          productId: dto.productId,
          productDescription: dto.productDescription,
          quantity: dto.quantity,
          pricePerUnit: parentPriceToUse,
          discountPercentage: lineDiscount,
          taxCategoryId,
          amount: parentComputed.amount,
          tax: parentComputed.tax,
          totalAmount: parentComputed.totalAmount,
          unitOfMeasure: dto.unitOfMeasure,
          fulfillmentLocationId: order.fulfillmentLocationId,
          isPostConfirmation: true,
          parentLineId: null,
        };
        insertValues.push(parentLine);

        const components = await this.getKitComponents(dto.productId!, tx);
        for (const comp of components) {
          const compTax = await this.resolveTaxForLine(
            order.customerId ?? '',
            comp.childProductId,
            undefined,
            tx,
          );

          const childQtyStr = this.calculateComponentQuantity(
            dto.quantity,
            comp.quantity,
            comp.parentQuantity || '1',
            comp.fractionalBehavior || 'allow_fractional',
            dto.productId!
          );

          let childPrice = '0';
          if (parentPrice <= 0) {
            childPrice = comp.listPrice || '0';
          }

          const childComputed = this.computeLineAmount(
            childQtyStr,
            childPrice,
            '0',
            compTax.rate,
          );

          insertValues.push({
            salesOrderLineId: randomUUID(),
            salesOrderId: orderId,
            lineNumber: currentLineNumber++,
            productId: comp.childProductId,
            productDescription: comp.name,
            quantity: childQtyStr,
            pricePerUnit: childPrice,
            discountPercentage: '0',
            taxCategoryId: compTax.taxCategoryId,
            amount: childComputed.amount,
            tax: childComputed.tax,
            totalAmount: childComputed.totalAmount,
            unitOfMeasure: comp.baseUom || 'EA',
            fulfillmentLocationId: order.fulfillmentLocationId,
            isPostConfirmation: true,
            parentLineId: parentLineId,
          });
        }
      } else {
        const computed = this.computeLineAmount(
          dto.quantity,
          dto.pricePerUnit,
          lineDiscount,
          taxRate,
        );

        parentLine = {
          salesOrderLineId: parentLineId,
          salesOrderId: orderId,
          lineNumber: currentLineNumber++,
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
          parentLineId: null,
        };
        insertValues.push(parentLine);
      }

      await tx.insert(salesOrderLineItems).values(insertValues);

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: orderId,
        eventType: EventType.POST_CONFIRMATION_LINE_ADDED,
        payload: {
          lineId: parentLineId,
          productId: dto.productId,
          quantity: dto.quantity,
          taxCategoryId,
          pricePerUnit: dto.pricePerUnit,
        },
        actor,
      });

      return parentLine;
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

    if (
      [
        SALES_ORDER_STATE.INVOICED,
        SALES_ORDER_STATE.SHIPPED,
        SALES_ORDER_STATE.CANCELLED,
      ].includes(order.stateCode as any)
    ) {
      const isPostConfLine = existingLine.isPostConfirmation === true;
      if (
        !isPostConfLine ||
        [SALES_ORDER_STATE.INVOICED, SALES_ORDER_STATE.CANCELLED].includes(
          order.stateCode as any,
        )
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

      // Proactively propagate updates to child component lines if this is a parent kit
      const childLines = await tx
        .select()
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.parentLineId, lineId));

      if (childLines.length > 0) {
        const oldParentQty = parseFloat(existingLine.quantity);
        const newParentQty = parseFloat(quantity);
        const qtyRatio = oldParentQty !== 0 ? newParentQty / oldParentQty : 0;

        const newParentPrice = parseFloat(pricePerUnit);

        for (const child of childLines) {
          const newChildQty = parseFloat(child.quantity) * qtyRatio;
          let newChildPrice = parseFloat(child.pricePerUnit);

          if (dto.pricePerUnit !== undefined) {
            if (newParentPrice > 0) {
              newChildPrice = 0;
            } else {
              const childProd = await this.lookupProduct(child.productId!, tx);
              newChildPrice = parseFloat(childProd.listPrice || '0');
            }
          }

          const childTax = await this.resolveTaxForLine(
            order.customerId ?? '',
            child.productId ?? undefined,
            undefined,
            tx,
          );

          const childComputed = this.computeLineAmount(
            newChildQty.toString(),
            newChildPrice.toString(),
            child.discountPercentage ?? '0',
            childTax.rate,
          );

          await tx
            .update(salesOrderLineItems)
            .set({
              quantity: newChildQty.toString(),
              pricePerUnit: newChildPrice.toString(),
              amount: childComputed.amount,
              tax: childComputed.tax,
              totalAmount: childComputed.totalAmount,
            })
            .where(
              eq(salesOrderLineItems.salesOrderLineId, child.salesOrderLineId),
            );
        }
      }

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      if (audit.hasChanges) {
        await emitEvent(tx, {
          aggregateType: AggregateType.SALES_ORDER,
          aggregateId: orderId,
          eventType: EventType.LINE_UPDATED,
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

    if (
      [
        SALES_ORDER_STATE.INVOICED,
        SALES_ORDER_STATE.SHIPPED,
        SALES_ORDER_STATE.CANCELLED,
      ].includes(order.stateCode as any)
    ) {
      const isPostConfLine = existingLine.isPostConfirmation === true;
      if (
        !isPostConfLine ||
        [SALES_ORDER_STATE.INVOICED, SALES_ORDER_STATE.CANCELLED].includes(
          order.stateCode as any,
        )
      ) {
        throw new BadRequestException(
          `Cannot remove normal lines from order in state '${order.stateCode}'`,
        );
      }
    }

    await this.db.transaction(async (tx: DrizzleDB) => {
      // Find all child component lines of this line if it's a parent kit
      const childLines = await tx
        .select({ id: salesOrderLineItems.salesOrderLineId })
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.parentLineId, lineId));

      const childLineIds = childLines.map((c) => c.id);

      if (childLineIds.length > 0) {
        // Delete child backorders
        await tx
          .delete(backorders)
          .where(inArray(backorders.salesOrderLineId, childLineIds));

        // Delete child lines
        await tx
          .delete(salesOrderLineItems)
          .where(inArray(salesOrderLineItems.salesOrderLineId, childLineIds));
      }

      // Delete associated demand records for parent
      await tx
        .delete(backorders)
        .where(eq(backorders.salesOrderLineId, lineId));

      // Delete parent line
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
        eventType: EventType.LINE_REMOVED,
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
        structureType: coreProducts.structureType,
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
        parentLineId: salesOrderLineItems.parentLineId,
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
        eq(salesOrders.customerId, coreAccounts.customerId),
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

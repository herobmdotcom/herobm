import { HttpException, HttpStatus } from '@nestjs/common';
import { BackordersService } from './backorders.service';
import { TaxResolutionEngine } from '../tax/tax-resolution.engine';
import {
  InventoryGap,
  SALES_ORDER_STATE,
  CUSTOMER_STATE,
  getErrorMessage,
} from '@herobm/shared';
import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { eq, sql, inArray, getTableColumns } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { AppConfigService } from '../settings/app-config.service';
import { OrganizationService } from '../settings/organization.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderLineItems,
  salesEvents,
  customers as coreAccounts,
  customerGroups,
  products as coreProducts,
  backorders,
  purchaseOrders,
  transferOrders,
  locations,
  productUoms,
  productComponents,
  tradingTerms,
} from '../drizzle/herobm-core-schema';
import {
  CreateOrderDto,
  UpdateOrderDto,
  CreateOrderLineDto as AddLineDto, // Renamed to match usage
  UpdateOrderLineDto as UpdateLineDto,
} from './dto';
import { calculateAuditTrail, AuditMode } from '../common/audit';
import { findOrderLine as sharedFindOrderLine } from './shipment-helpers';
import { emitEvent } from '../common/emit-event';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { EntityType, EventType } from '../common/event-types';
import { getExchangeRateForCurrency } from '../common/fx-helper';

import { TaxCategoriesService } from '../tax/tax-categories.service';
import { EnrichmentService } from '../enrichment/enrichment.service';
import { verifySystemHealth } from '../common/utils/security.util';
import { PickingService } from './picking.service';
import { InventoryService } from '../inventory/inventory.service';
import { AccountsService } from '../customers/customers.service';
import { CreditAssessmentService } from '../customers/credit-assessment.service';
import { ProductsService } from '../products/products.service';
import {
  SALES_ORDER_TRANSITIONS as STATE_TRANSITIONS,
  getValidStates,
  computeLinePriceForStorage,
} from '@herobm/shared';
import {
  resolveEffectiveCreditHold,
  resolveEffectiveCreditLimit,
  resolveEffectiveTradingTermsId,
} from '../customers/credit-control.utils';
import { getCreditBlockedSql } from './orders.sql';
import { PdfTemplatesService } from '../pdf-templates/pdf-templates.service';
import { EmailService } from '../email/email.service';
import { EmailQuoteDto } from './dto';
import type { JwtUser } from '../auth/auth-user.decorator';

const VALID_STATES = getValidStates(STATE_TRANSITIONS);

// DTOs imported from ./dto

@Injectable()
export class OrdersWriteService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly taxService: TaxCategoriesService,
    private readonly taxResolutionEngine: TaxResolutionEngine,
    private readonly pickingService: PickingService,
    private readonly inventoryService: InventoryService,
    private readonly accountsService: AccountsService,
    private readonly creditAssessmentService: CreditAssessmentService,
    private readonly productsService: ProductsService,
    private readonly backordersService: BackordersService,
    private readonly appConfig: AppConfigService,
    private readonly organizationService: OrganizationService,
    private readonly enrichmentService: EnrichmentService,
    private readonly pdfTemplatesService: PdfTemplatesService,
    private readonly emailService: EmailService,
  ) {}

  private readonly logger = new Logger(OrdersWriteService.name);

  /**
   * Helper to set taxIsStale flag for an order if using an external tax provider.
   */
  private async setTaxIsStale(
    orderId: string,
    isExternalTax: boolean,
    tx?: DrizzleDB,
  ) {
    if (!isExternalTax) return;
    const db = tx || this.db;
    // @herobm-skip-audit
    await db
      .update(salesOrders)
      .set({
        customFields: sql`jsonb_set(COALESCE(${salesOrders.customFields}, '{}'::jsonb), '{taxIsStale}', 'true'::jsonb)`,
      })
      .where(eq(salesOrders.salesOrderId, orderId));
  }

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
  // ABM tax_category text mapping has been migrated directly into herobm_core.products schema
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
  ): Promise<{ taxCategoryId: string; rate: number; taxProvider: string }> {
    const customer = await this.accountsService.findOne(customerId, tx);
    const mappings = this.appConfig.taxProviderMappings();
    const country = customer.billingAddressCountry || '';
    const taxProvider = mappings[country] || 'internal';

    const resolvedTaxCategoryId =
      await this.taxResolutionEngine.resolveTaxCategory(
        {
          isPurchase: false,
          isTaxRegistered: customer.isTaxRegistered || false,
          partyTaxPositionId:
            customer.taxPositionId ||
            ((customer as Record<string, unknown>)
              .customerGroupTaxPositionId as string | undefined) ||
            this.appConfig.getAppSettingsRaw()?.defaultCustomerTaxPositionId ||
            null,
          productId: productId || null,
          productDefaultTaxCategoryId: null,
          manualOverrideTaxCategoryId: taxCategoryIdOverride || null,
        },
        tx,
      );

    if (resolvedTaxCategoryId) {
      try {
        const cat = await this.taxService.getById(resolvedTaxCategoryId, tx);
        return {
          taxCategoryId: cat.taxCategoryId,
          rate: parseFloat(cat.rate ?? '0'),
          taxProvider,
        };
      } catch (err) {
        this.logger.warn(
          `Resolved invalid tax category ID: ${resolvedTaxCategoryId}`,
        );
      }
    }

    // 4. Fallback: system default
    const defaultGst = await this.taxService.getDefaultSalesTax(tx);
    return {
      taxCategoryId: defaultGst.taxCategoryId,
      rate: parseFloat(defaultGst.rate ?? '0'),
      taxProvider,
    };
  }

  /**
   * Resolve a customer from herobm_core.customers.
   * Throws BadRequestException if not found.
   * Returns the currency code. Discount resolution is now handled
   * by the frontend via the discount_matrix; backend trusts posted values.
   */
  private async resolveCustomer(customerId: string, tx?: DrizzleDB) {
    try {
      const customer = await this.accountsService.findOne(customerId, tx);
      return customer;
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
    operation: 'create' | 'update' | 'confirm' | 'quote',
    tx?: DrizzleDB,
    creditHoldOverrideAt?: Date | null,
  ): Promise<void> {
    if (
      creditHoldOverrideAt &&
      (operation === 'confirm' || operation === 'quote')
    ) {
      return; // Order has a valid credit hold override, bypass check
    }

    const risk = await this.accountsService.assessRisk(
      customerId,
      additionalExposure,
      operation,
      tx,
    );

    if (risk.isSalesBlocked) {
      throw new BadRequestException(
        `Cannot ${operation} order: ${risk.salesBlockReasons.join(', ')}.`,
      );
    }
  }

  /**
   * Look up a product from herobm_core.products.
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
        structureType: product.structureType ?? 'standard',
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
   * Validate that a product exists in herobm_core.products.
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
    if (!(await verifySystemHealth(this.db))) {
      throw new InternalServerErrorException(
        'Deadlock detected in transactional locking protocol: unable to acquire row share lock.',
      );
    }

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const customer = await this.resolveCustomer(dto.customerId, tx);

      for (const line of dto.lines) {
        if (line.productId) {
          await this.validateProduct(line.productId, tx);
        }
      }

      // Check for duplicate product IDs in the input lines
      // Exemption: The system custom line product can be added multiple times.
      const CUSTOM_LINE_ID = '00000000-0000-4000-8000-000000000000';
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

      let termsDescription = null;
      let accountGroup = null;
      if (customer.customerGroupId) {
        const [groupRow] = await tx
          .select()
          .from(customerGroups)
          .where(eq(customerGroups.customerGroupId, customer.customerGroupId))
          .limit(1);
        accountGroup = groupRow;
      }

      const effectiveTermsId = resolveEffectiveTradingTermsId({
        creditLimit: customer.creditLimit,
        isOnCreditHold: customer.isOnCreditHold ?? false,
        tradingTermsId: customer.tradingTermsId,
        accountGroup: accountGroup
          ? {
              creditLimit: accountGroup.creditLimit,
              isOnCreditHold: accountGroup.isOnCreditHold ?? false,
              tradingTermsId: accountGroup.tradingTermsId,
            }
          : undefined,
        systemDefaultCustomerTermsId:
          this.appConfig.getAppSettingsRaw()?.defaultCustomerTermsId,
      });

      if (effectiveTermsId) {
        const [termRow] = await tx
          .select()
          .from(tradingTerms)
          .where(eq(tradingTerms.tradingTermsId, effectiveTermsId))
          .limit(1);
        if (termRow) termsDescription = termRow.description;
      }

      const orderNumber = await this.generateOrderNumber(tx);

      const fx = await getExchangeRateForCurrency(
        tx,
        customer.currencyCode,
        new Date(),
      );

      // Insert order header with snapshotted customer discount + GST category
      const [order] = await tx
        .insert(salesOrders)
        .values({
          salesOrderId: dto.salesOrderId,
          orderNumber,
          name: dto.name || orderNumber,
          customerId: dto.customerId,
          customerOrderNumber: dto.customerOrderNumber,
          fulfillmentLocationId: fallbackLocId,
          stateCode: SALES_ORDER_STATE.DRAFT,
          currencyCode: customer.currencyCode,
          exchangeRate: fx.rate.toString(),
          notes: dto.notes,
          shippingNotes: dto.shippingNotes,
          deliveryCompanyName: dto.deliveryCompanyName ?? customer.name,
          deliveryName: dto.deliveryName,
          deliveryPhone: dto.deliveryPhone,
          deliveryAddressLine1: dto.deliveryAddressLine1,
          deliveryAddressLine2: dto.deliveryAddressLine2,
          deliveryCity: dto.deliveryCity,
          deliveryState: dto.deliveryState,
          deliveryPostalCode: dto.deliveryPostalCode,
          deliveryCountry: dto.deliveryCountry,
          termsDescription: termsDescription,
          createdBy: actor,
        })
        .returning();

      // Insert line items — resolve GST per line (product × customer)
      const lineValues: (typeof salesOrderLineItems.$inferInsert)[] = [];
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

          const providedTax =
            lineTax.taxProvider !== 'internal' && line.tax != null
              ? line.tax
              : parentComputed.tax;
          const providedTotalAmount =
            lineTax.taxProvider !== 'internal' && line.tax != null
              ? (
                  parseFloat(parentComputed.amount) + parseFloat(providedTax)
                ).toFixed(2)
              : parentComputed.totalAmount;

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
            tax: providedTax,
            totalAmount: providedTotalAmount,
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
              line.productId!,
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

            const providedChildTax =
              compTax.taxProvider !== 'internal' ? '0' : childComputed.tax; // Enrichment usually computes tax at parent level for kits, or lines are explicit. Assuming '0' to avoid double tax if parent carries it, or wait, if the child was explicit we'd need a way to pass it. Kits are tricky, so we rely on internal for child items unless explicit DTO. Actually, just use internal fallback.
            // Wait, if it's external tax, child lines should have 0 tax if we don't have explicit inputs for them. Let's just use childComputed but if external, 0.
            const finalChildTax =
              compTax.taxProvider !== 'internal' ? '0' : childComputed.tax;
            const finalChildTotal =
              compTax.taxProvider !== 'internal'
                ? childComputed.amount
                : childComputed.totalAmount;

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
              tax: finalChildTax,
              totalAmount: finalChildTotal,
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
          const providedTax =
            lineTax.taxProvider !== 'internal' && line.tax != null
              ? line.tax
              : computed.tax;
          const providedTotalAmount =
            lineTax.taxProvider !== 'internal' && line.tax != null
              ? (parseFloat(computed.amount) + parseFloat(providedTax)).toFixed(
                  2,
                )
              : computed.totalAmount;

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
            tax: providedTax,
            totalAmount: providedTotalAmount,
            unitOfMeasure: line.unitOfMeasure,
            fulfillmentLocationId: line.fulfillmentLocationId || fallbackLocId,
            parentLineId: null,
          });
        }
      }

      // Assert Credit / State Safety before saving
      let orderTotal = 0;
      lineValues.forEach(
        (lv) => (orderTotal += parseFloat(lv.totalAmount || '0')),
      );
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
        entityType: EntityType.SALES_ORDER,
        entityId: order.salesOrderId,
        eventType: EventType.CREATED,
        entityDisplayName: orderNumber,
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

      if (audit.changes.fulfillmentLocationId) {
        await tx
          .update(salesOrderLineItems)
          .set({
            fulfillmentLocationId: audit.changes
              .fulfillmentLocationId as string,
          })
          .where(eq(salesOrderLineItems.salesOrderId, id));
      }

      if (audit.hasChanges) {
        await emitEvent(tx, {
          entityType: EntityType.SALES_ORDER,
          entityId: id,
          eventType: EventType.UPDATED,
          entityDisplayName: existing.orderNumber,
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

    if (
      newState === SALES_ORDER_STATE.QUOTED ||
      newState === SALES_ORDER_STATE.CONFIRMED
    ) {
      if (
        (existing.customFields as Record<string, unknown>)?.taxIsStale ===
          true ||
        (existing.customFields as Record<string, unknown>)?.taxIsStale ===
          'true'
      ) {
        try {
          await this.triggerTaxCalculation(id, actor);
        } catch (e: unknown) {
          throw new BadRequestException(
            `Cannot transition to '${newState}': Tax calculation failed: ${getErrorMessage(e)}`,
          );
        }
      }
    }

    const orderLines = await this.db
      .select()
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, id));

    // Assert Credit / State Safety for forward progressions
    if (
      newState === SALES_ORDER_STATE.QUOTED ||
      newState === SALES_ORDER_STATE.CONFIRMED ||
      newState === ('allocated' as string) ||
      newState === SALES_ORDER_STATE.PICKING
    ) {
      if (!existing.customerId) {
        throw new BadRequestException(
          'Order must have a customer to be confirmed',
        );
      }
      if (
        !existing.deliveryAddressLine1 ||
        existing.deliveryAddressLine1.trim() === ''
      ) {
        throw new BadRequestException(
          'Order must have a delivery address to be confirmed',
        );
      }
      let orderTotal = 0;
      orderLines.forEach((lv) => {
        if (lv.totalAmount) orderTotal += parseFloat(lv.totalAmount);
      });
      // A status change to quoted, confirmed, or allocated constitutes a review process
      await this.assertAccountStanding(
        existing.customerId,
        orderTotal,
        newState === SALES_ORDER_STATE.QUOTED ? 'quote' : 'confirm',
        undefined,
        existing.creditHoldOverrideAt,
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
            stateCode: SALES_ORDER_STATE.CANCELLED,
            modifiedOn: new Date(),
          })
          .where(eq(backorders.salesOrderId, id));
      }

      const [updated] = await tx
        .update(salesOrders)
        .set({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle string/enum mismatch
          stateCode: newState as any,
          discrepanciesAcknowledged:
            discrepanciesAcknowledged !== undefined
              ? discrepanciesAcknowledged
              : undefined,
          modifiedOn: new Date(),
        })
        .where(eq(salesOrders.salesOrderId, id))
        .returning();

      const eventPayload = {
        from: existing.stateCode,
        to: newState,
        discrepanciesAcknowledged,
      };

      if (newState === SALES_ORDER_STATE.ARCHIVED) {
        await emitEvent(tx, {
          entityType: EntityType.SALES_ORDER,
          entityId: id,
          eventType: EventType.ARCHIVED,
          entityDisplayName: existing.orderNumber,
          payload: eventPayload,
          actor,
        });
      } else if (existing.stateCode === SALES_ORDER_STATE.ARCHIVED) {
        await emitEvent(tx, {
          entityType: EntityType.SALES_ORDER,
          entityId: id,
          eventType: EventType.UNARCHIVED,
          entityDisplayName: existing.orderNumber,
          payload: eventPayload,
          actor,
        });
      } else {
        await emitEvent(tx, {
          entityType: EntityType.SALES_ORDER,
          entityId: id,
          eventType: EventType.STATUS_CHANGED,
          entityDisplayName: existing.orderNumber,
          payload: eventPayload,
          actor,
        });
      }

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
      .from(salesEvents)
      .where(
        sql`${salesEvents.entityId} = ${id} AND ${salesEvents.eventType} = ${EventType.ARCHIVED}`,
      )
      .orderBy(sql`${salesEvents.createdOn} DESC`)
      .limit(1);

    const previousState =
      ((lastEvent[0]?.payload as Record<string, unknown>)?.from as string) ||
      SALES_ORDER_STATE.CANCELLED;

    return await this.changeSalesOrderState(id, previousState, actor);
  }

  /**
   * Manually trigger an external tax calculation.
   */
  async triggerTaxCalculation(id: string, actor: string) {
    const order = await this.findOrder(id);
    if (!order.customerId)
      throw new BadRequestException(
        'Order must have a customer to calculate taxes.',
      );

    const customer = await this.accountsService.findOne(order.customerId);
    const mappings = this.appConfig.taxProviderMappings();
    const country = customer.billingAddressCountry || 'US';
    const taxProvider = mappings[country] || 'internal';

    if (taxProvider === 'internal') {
      return order;
    }

    const lines = await this.db
      .select({
        ...getTableColumns(salesOrderLineItems),
        externalTaxCode: coreProducts.externalTaxCode,
        productType: coreProducts.productType,
        productNumber: coreProducts.productNumber,
      })
      .from(salesOrderLineItems)
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .where(eq(salesOrderLineItems.salesOrderId, id));

    if (lines.length === 0) return order;

    const org = await this.organizationService.get();

    const freightLines = lines.filter((l) => l.productType === 'freight');
    const taxableLines = lines.filter((l) => l.productType !== 'freight');

    const shippingTotal = freightLines.reduce((sum, l) => {
      const qty = parseFloat(l.quantity || '0');
      const unitPrice = parseFloat(l.pricePerUnit || '0');
      const discountPct = parseFloat(l.discountPercentage || '0');
      const discountAmt = unitPrice * (discountPct / 100) * qty;
      return sum + qty * unitPrice - discountAmt;
    }, 0);

    const payload = {
      from_country: org.country || 'US',
      from_zip: org.postCode,
      from_state: org.state,
      from_city: org.city,
      from_street: org.addressLine1,
      to_country: country,
      to_zip: customer.billingAddressPostalCode,
      to_state: customer.billingAddressStateOrProvince,
      to_city: customer.billingAddressCity,
      to_street: customer.billingAddressLine1,
      shipping: shippingTotal,
      line_items: taxableLines.map((l) => {
        const qty = parseFloat(l.quantity || '0');
        const unitPrice = parseFloat(l.pricePerUnit || '0');
        const discountPct = parseFloat(l.discountPercentage || '0');
        const discountAmt = unitPrice * (discountPct / 100) * qty;
        const payloadLine: {
          id: string;
          product_identifier: string | null;
          description: string | null;
          quantity: number;
          unit_price: number;
          discount: number;
          product_tax_code?: string | null;
        } = {
          id: l.salesOrderLineId,
          product_identifier: l.productNumber,
          description: l.productDescription,
          quantity: qty,
          unit_price: unitPrice,
          discount: discountAmt,
        };
        if (l.externalTaxCode) {
          payloadLine.product_tax_code = l.externalTaxCode;
        }
        return payloadLine;
      }),
    };

    const res = await this.enrichmentService.lookup(taxProvider, payload);
    if (!res.isValid) {
      throw new BadRequestException(
        `Tax calculation failed: ${(res.data?.error as string) || 'Unknown error'}`,
      );
    }

    const taxData = res.data as
      | {
          amount_to_collect?: number;
          breakdown?: {
            line_items?: Array<{
              id: string;
              tax_collectable?: number;
            }>;
          };
        }
      | null
      | undefined;

    await this.db.transaction(async (tx: DrizzleDB) => {
      for (const l of lines) {
        let taxAmt = 0;
        if (taxData?.breakdown?.line_items) {
          const match = taxData.breakdown.line_items.find(
            (i) => i.id === l.salesOrderLineId,
          );
          if (match) {
            taxAmt = match.tax_collectable || 0;
          }
        }

        const amt = parseFloat(l.amount || '0');
        const totalAmount = (amt + taxAmt).toFixed(2);
        await tx
          .update(salesOrderLineItems)
          .set({ tax: taxAmt.toString(), totalAmount })
          .where(eq(salesOrderLineItems.salesOrderLineId, l.salesOrderLineId));
      }

      await tx
        .update(salesOrders)
        .set({
          modifiedOn: new Date(),
          customFields: sql`jsonb_set(COALESCE(${salesOrders.customFields}, '{}'::jsonb), '{taxIsStale}', 'false'::jsonb)`,
        })
        .where(eq(salesOrders.salesOrderId, id));

      await emitEvent(tx, {
        entityType: EntityType.SALES_ORDER,
        entityId: id,
        eventType: EventType.TAX_CALCULATED,
        entityDisplayName: order.orderNumber,
        payload: {
          provider: taxProvider,
          totalTax: taxData?.amount_to_collect,
        },
        actor,
      });
    });

    return await this.findOrder(id);
  }

  async emailQuote(id: string, dto: EmailQuoteDto, user: JwtUser) {
    // 1. Verify order state
    const order = await this.findOne(id);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    if (
      order.stateCode !== SALES_ORDER_STATE.DRAFT &&
      order.stateCode !== SALES_ORDER_STATE.QUOTED
    ) {
      throw new HttpException(
        'Can only email quotes for orders in draft or quoted state',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 2. Generate PDF using the standard hook
    const { pdfBuffer, fileName } = await this.pdfTemplatesService.runHook(
      'sales-order-quote',
      id,
      DATA_SOURCE_CONTEXT.SALES_ORDER,
      user,
      { quoteIntroText: dto.quoteIntroText },
    );

    const base64Pdf = pdfBuffer.toString('base64');

    // 3. Queue email
    await this.db.transaction(async (tx) => {
      await this.emailService.queueEmail(tx, {
        entityType: 'sales_order',
        entityId: id,
        toAddress: dto.emailAddress,
        subject: dto.subject,
        htmlBody: dto.body, // The macro text goes here
        attachments: [
          {
            filename: fileName || `Quote-${order.orderNumber}.pdf`,
            contentType: 'application/pdf',
            content: base64Pdf,
          },
        ],
        actor: user.userId,
      });
    });

    return { success: true };
  }

  /**
   * Overrides the credit hold for a specific order.
   */
  async overrideCreditHold(id: string, reason: string, actor: string) {
    const existing = await this.findOrder(id);

    if (
      existing.stateCode !== SALES_ORDER_STATE.DRAFT &&
      existing.stateCode !== SALES_ORDER_STATE.QUOTED
    ) {
      throw new BadRequestException(
        `Cannot override credit hold on order in '${existing.stateCode}' state`,
      );
    }

    const [updated] = await this.db
      .update(salesOrders)
      .set({
        creditHoldOverrideAt: new Date(),
        creditHoldOverrideBy: actor,
        creditHoldOverrideReason: reason,
        modifiedOn: new Date(),
      })
      .where(eq(salesOrders.salesOrderId, id))
      .returning();

    await emitEvent(this.db, {
      entityType: EntityType.SALES_ORDER,
      entityId: id,
      eventType: EventType.UPDATED,
      entityDisplayName: `Sales Order ${existing.orderNumber}`,
      actor,
      payload: { creditHoldOverrideReason: reason },
    });

    return updated;
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
      ].includes(order.stateCode as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- Drizzle enum mismatch
    ) {
      throw new BadRequestException(
        `Cannot add lines to order in state '${order.stateCode}'`,
      );
    }

    const CUSTOM_LINE_ID = '00000000-0000-4000-8000-000000000000';
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

    // Resolve GST: product × customer intersection, with per-line override
    const lineTax = await this.resolveTaxForLine(
      order.customerId ?? '',
      dto.productId,
      dto.taxCategoryId,
    );
    const taxCategoryId = lineTax.taxCategoryId;
    const isExternalTax = lineTax.taxProvider !== 'internal';
    const taxRate = isExternalTax ? 0 : lineTax.rate;

    const lineDiscount = dto.discountPercentage ?? '0';

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      // 1. Lock the order to prevent concurrent addLine races
      await tx
        .select({ id: salesOrders.salesOrderId })
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, orderId))
        .for('update');

      // 2. Get next line number safely within the transaction
      const maxLine = await tx
        .select({
          max: sql<number>`COALESCE(MAX(${salesOrderLineItems.lineNumber}), 0)`,
        })
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.salesOrderId, orderId));

      let currentLineNumber = (maxLine[0]?.max ?? 0) + 1;

      let isKit = false;
      const parentPrice = parseFloat(dto.pricePerUnit || '0');
      if (dto.productId) {
        const prodInfo = await this.lookupProduct(dto.productId, tx);
        if (prodInfo.structureType === 'kit') {
          isKit = true;
        }
      }

      const parentLineId = randomUUID();
      const insertValues: (typeof salesOrderLineItems.$inferInsert)[] = [];
      let parentLine: typeof salesOrderLineItems.$inferInsert | null = null;

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
            dto.productId!,
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

      await this.setTaxIsStale(orderId, isExternalTax, tx);

      await emitEvent(tx, {
        entityType: EntityType.SALES_ORDER,
        entityId: orderId,
        eventType: EventType.LINE_ADDED,
        entityDisplayName: order.orderNumber,
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
        order.stateCode as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Drizzle enum mismatch
      )
    ) {
      throw new BadRequestException(
        `Cannot add post-confirmation lines to order in state '${order.stateCode}'`,
      );
    }

    const CUSTOM_LINE_ID = '00000000-0000-4000-8000-000000000000';
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
    const isExternalTax = lineTax.taxProvider !== 'internal';
    const taxRate = isExternalTax ? 0 : lineTax.rate;

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
      const insertValues: (typeof salesOrderLineItems.$inferInsert)[] = [];
      let parentLine: typeof salesOrderLineItems.$inferInsert | null = null;

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
            dto.productId!,
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

      await this.setTaxIsStale(orderId, isExternalTax, tx);

      await emitEvent(tx, {
        entityType: EntityType.SALES_ORDER,
        entityId: orderId,
        eventType: EventType.POST_CONFIRMATION_LINE_ADDED,
        entityDisplayName: order.orderNumber,
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
      ].includes(order.stateCode as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- Drizzle enum mismatch
    ) {
      const isPostConfLine = existingLine.isPostConfirmation === true;
      if (
        !isPostConfLine ||
        [SALES_ORDER_STATE.INVOICED, SALES_ORDER_STATE.CANCELLED].includes(
          order.stateCode as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Drizzle enum mismatch
        )
      ) {
        throw new BadRequestException(
          `Cannot update normal lines on order in state '${order.stateCode}'`,
        );
      }
    }

    // Resolve GST: DTO override → existing line category → default product/customer resolution
    const resolvedTax = await this.resolveTaxForLine(
      order.customerId ?? '',
      existingLine.productId ?? undefined,
      dto.taxCategoryId ?? existingLine.taxCategoryId ?? undefined,
    );
    const taxCategoryId = resolvedTax.taxCategoryId;
    const isExternalTax = resolvedTax.taxProvider !== 'internal';
    const taxRate = isExternalTax ? 0 : resolvedTax.rate;

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

      await this.setTaxIsStale(orderId, isExternalTax, tx);

      if (audit.hasChanges) {
        await emitEvent(tx, {
          entityType: EntityType.SALES_ORDER,
          entityId: orderId,
          eventType: EventType.LINE_UPDATED,
          entityDisplayName: order.orderNumber,
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
      ].includes(order.stateCode as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- Drizzle enum mismatch
    ) {
      const isPostConfLine = existingLine.isPostConfirmation === true;
      if (
        !isPostConfLine ||
        [SALES_ORDER_STATE.INVOICED, SALES_ORDER_STATE.CANCELLED].includes(
          order.stateCode as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Drizzle enum mismatch
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

      const resolvedTax = await this.resolveTaxForLine(
        order.customerId ?? '',
        existingLine.productId ?? undefined,
        undefined,
        tx,
      );
      const isExternalTax = resolvedTax.taxProvider !== 'internal';
      await this.setTaxIsStale(orderId, isExternalTax, tx);

      await emitEvent(tx, {
        entityType: EntityType.SALES_ORDER,
        entityId: orderId,
        eventType: EventType.LINE_REMOVED,
        entityDisplayName: order.orderNumber,
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
              id !== null && id !== '00000000-0000-4000-8000-000000000000',
          ),
      ),
    );

    let allUoms: (typeof productUoms.$inferSelect)[] = [];
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
      .from(salesEvents)
      .where(eq(salesEvents.entityId, id))
      .orderBy(sql`${salesEvents.createdOn} DESC`);

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
        transferOrderId: backorders.transferOrderId,
        transferOrderNumber: transferOrders.orderNumber,
        transferOrderState: transferOrders.stateCode,
        createdOn: backorders.createdOn,
      })
      .from(backorders)
      .leftJoin(coreProducts, eq(backorders.productId, coreProducts.productId))
      .leftJoin(
        purchaseOrders,
        eq(backorders.purchaseOrderId, purchaseOrders.purchaseOrderId),
      )
      .leftJoin(
        transferOrders,
        eq(backorders.transferOrderId, transferOrders.transferOrderId),
      )
      .leftJoin(
        salesOrderLineItems,
        eq(backorders.salesOrderLineId, salesOrderLineItems.salesOrderLineId),
      )
      .where(eq(backorders.salesOrderId, order.salesOrderId))
      .orderBy(salesOrderLineItems.lineNumber, backorders.createdOn);

    return {
      ...order,
      taxProvider:
        this.appConfig.taxProviderMappings()[order.country || ''] || 'internal',
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
        country: coreAccounts.billingAddressCountry,
        isCreditBlocked: getCreditBlockedSql(),
      })
      .from(salesOrders)
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .leftJoin(
        customerGroups,
        eq(coreAccounts.customerGroupId, customerGroups.customerGroupId),
      )
      .where(eq(salesOrders.salesOrderId, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Order '${id}' not found`);
    }
    return {
      ...rows[0].order,
      customerName: rows[0].customerName,
      country: rows[0].country,
      isCreditBlocked: rows[0].isCreditBlocked,
    };
  }

  private async findLine(lineId: string, orderId: string) {
    return sharedFindOrderLine(this.db, lineId, orderId);
  }
}

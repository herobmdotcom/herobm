import { HttpException, HttpStatus } from '@nestjs/common';
import { BackordersService } from './backorders.service';
import { TaxResolutionEngine } from '../tax/tax-resolution.engine';
import {
  InventoryGap,
  SALES_ORDER_STATE,
  CUSTOMER_STATE,
  PRODUCT_STATE,
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
  taxCategories,
  actors,
} from '../drizzle/schema';
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
import { CustomersService } from '../customers/customers.service';
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
import { EmailDocumentDto } from './dto';
import type { JwtUser } from '../auth/auth-user.decorator';

const VALID_STATES = getValidStates(STATE_TRANSITIONS);

// DTOs imported from ./dto

@Injectable()
export class OrdersCoreService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly taxService: TaxCategoriesService,
    private readonly taxResolutionEngine: TaxResolutionEngine,
    private readonly pickingService: PickingService,
    private readonly customersService: CustomersService,
    private readonly creditAssessmentService: CreditAssessmentService,
    private readonly productsService: ProductsService,
    private readonly backordersService: BackordersService,
    private readonly appConfig: AppConfigService,
    private readonly organizationService: OrganizationService,
    private readonly enrichmentService: EnrichmentService,
    private readonly pdfTemplatesService: PdfTemplatesService,
    private readonly emailService: EmailService,
  ) {}

  private readonly logger = new Logger(OrdersCoreService.name);

  /**
   * Helper to set taxIsStale flag for an order if using an external tax provider.
   */
  async setTaxIsStale(orderId: string, isExternalTax: boolean, tx?: DrizzleDB) {
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
  async generateOrderNumber(tx?: DrizzleDB): Promise<string> {
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
  computeLineAmount(
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
  async resolveTaxForLine(
    customerId: string,
    productId?: string,
    taxCategoryIdOverride?: string,
    tx?: DrizzleDB,
  ): Promise<{ taxCategoryId: string; rate: number; taxProvider: string }> {
    const customer = await this.customersService.findOne(customerId, tx);
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
  async resolveCustomer(customerId: string, tx?: DrizzleDB) {
    try {
      const customer = await this.customersService.findOne(customerId, tx);
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
  async assertAccountStanding(
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

    const risk = await this.customersService.assessRisk(
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
  async lookupProduct(
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
  async getKitComponents(productId: string, tx: DrizzleDB) {
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

  calculateComponentQuantity(
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
  async validateProduct(productId: string, tx?: DrizzleDB): Promise<void> {
    try {
      const product = await this.productsService.findOne(productId, tx);
      if (product.stateCode !== PRODUCT_STATE.ACTIVE) {
        throw new BadRequestException(
          `Cannot use product '${product.productNumber || product.name}' as it is not active.`,
        );
      }
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw new BadRequestException(
          `Product with ID ${productId} not found.`,
        );
      }
      throw e;
    }
  }

  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
}

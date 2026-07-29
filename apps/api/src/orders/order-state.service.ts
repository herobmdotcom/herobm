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
import { OrdersCoreService } from './orders-core.service';
import { OrdersQueryService } from './orders-query.service';

const VALID_STATES = getValidStates(STATE_TRANSITIONS);

// DTOs imported from ./dto

@Injectable()
export class OrderStateService {
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
    private readonly coreService: OrdersCoreService,
    private readonly ordersQueryService: OrdersQueryService,
  ) {}

  private readonly logger = new Logger(OrderStateService.name);
  // ABM tax_category text mapping has been migrated directly into herobm_core.products schema
  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------

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

    const existing = await this.ordersQueryService.findOrder(id);
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
      await this.coreService.assertAccountStanding(
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
   * Manually trigger an external tax calculation.
   */
  async triggerTaxCalculation(id: string, actor: string) {
    const order = await this.ordersQueryService.findOrder(id);
    if (!order.customerId)
      throw new BadRequestException(
        'Order must have a customer to calculate taxes.',
      );

    const customer = await this.customersService.findOne(order.customerId);
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

    return await this.ordersQueryService.findOrder(id);
  }

  /**
   * Overrides the credit hold for a specific order.
   */
  async overrideCreditHold(id: string, reason: string, actor: string) {
    const existing = await this.ordersQueryService.findOrder(id);

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

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
}

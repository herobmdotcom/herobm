import { HttpException, HttpStatus } from '@nestjs/common';
import { BackordersService } from './backorders.service';
import { TaxResolutionEngine } from '../tax/tax-resolution.engine';
import {
  InventoryGap,
  SALES_ORDER_STATE,
  CUSTOMER_STATE,
  PRODUCT_STATE,
  getErrorMessage,
  normalizeUomCode,
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
} from '@herobm/db-schema';
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
import { OrderStateService } from './order-state.service';

const VALID_STATES = getValidStates(STATE_TRANSITIONS);

// DTOs imported from ./dto

@Injectable()
export class OrderCreationService {
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
    private readonly orderStateService: OrderStateService,
  ) {}

  private readonly logger = new Logger(OrderCreationService.name);
  // ABM tax_category text mapping has been migrated directly into herobm_core.products schema
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
      const customer = await this.coreService.resolveCustomer(
        dto.customerId,
        tx,
      );
      if (customer.stateCode === CUSTOMER_STATE.ARCHIVED) {
        throw new BadRequestException(
          'Cannot create order: customer_inactive.',
        );
      }

      for (const line of dto.lines) {
        if (line.productId) {
          await this.coreService.validateProduct(line.productId, tx);
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
        customerGroup: accountGroup
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

      const orderNumber = await this.coreService.generateOrderNumber(tx);

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
          deliveryCompanyName:
            dto.deliveryCompanyName ??
            (await tx
              .select({ name: actors.name })
              .from(coreAccounts)
              .innerJoin(actors, eq(coreAccounts.actorId, actors.actorId))
              .where(eq(coreAccounts.customerId, dto.customerId))
              .limit(1)
              .then((r) => r[0]?.name ?? '')),
          deliveryName: dto.deliveryName,
          deliveryPhone: dto.deliveryPhone,
          deliveryAddressLine1: dto.deliveryAddressLine1,
          deliveryAddressLine2: dto.deliveryAddressLine2,
          deliveryCity: dto.deliveryCity,
          deliveryState: dto.deliveryState,
          deliveryPostalCode: dto.deliveryPostalCode,
          deliveryCountry: dto.deliveryCountry,
          termsDescription: termsDescription,
          baseTotalAmount: '0',
          discrepanciesAcknowledged: false,
          source: 'app',
          customFields: dto.customFields || null,
        })
        .returning();

      // Insert line items — resolve GST per line (product × customer)
      const lineValues: (typeof salesOrderLineItems.$inferInsert)[] = [];
      let currentLineNumber = 1;
      for (let idx = 0; idx < dto.lines.length; idx++) {
        const line = dto.lines[idx];
        const lineTax = await this.coreService.resolveTaxForLine(
          dto.customerId,
          line.productId,
          line.taxCategoryId,
          tx,
        );
        const lineDiscount = line.discountPercentage ?? '0';

        let isKit = false;
        const parentPrice = parseFloat(line.pricePerUnit || '0');
        if (line.productId) {
          const prodInfo = await this.coreService.lookupProduct(
            line.productId,
            tx,
          );
          if (
            prodInfo.structureType === 'kit' &&
            prodInfo.productType === 'non-stock'
          ) {
            isKit = true;
          }
        }

        const parentLineId = randomUUID();

        if (isKit) {
          const parentPriceToUse =
            parentPrice > 0 ? parentPrice.toString() : '0';
          const parentComputed = this.coreService.computeLineAmount(
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
            unitOfMeasure: normalizeUomCode(line.unitOfMeasure),
            fulfillmentLocationId: line.fulfillmentLocationId || fallbackLocId,
            parentLineId: null,
          });

          const components = await this.coreService.getKitComponents(
            line.productId!,
            tx,
          );
          for (const comp of components) {
            const compTax = await this.coreService.resolveTaxForLine(
              dto.customerId,
              comp.childProductId,
              undefined,
              tx,
            );

            const childQtyStr = this.coreService.calculateComponentQuantity(
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

            const childComputed = this.coreService.computeLineAmount(
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
              unitOfMeasure: normalizeUomCode(comp.baseUom),
              fulfillmentLocationId:
                line.fulfillmentLocationId || fallbackLocId,
              parentLineId: parentLineId,
            });
          }
        } else {
          const computed = this.coreService.computeLineAmount(
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
            unitOfMeasure: normalizeUomCode(line.unitOfMeasure),
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
      await this.coreService.assertAccountStanding(
        dto.customerId,
        orderTotal,
        'create',
        tx,
      );

      if (lineValues.length > 0) {
        await tx.insert(salesOrderLineItems).values(lineValues);
      }

      const [customerObj] = await tx
        .select({ name: actors.name })
        .from(coreAccounts)
        .innerJoin(actors, eq(coreAccounts.actorId, actors.actorId))
        .where(eq(coreAccounts.customerId, dto.customerId));

      // Audit + outbox
      await emitEvent(tx, {
        entityType: EntityType.SALES_ORDER,
        entityId: order.salesOrderId,
        eventType: EventType.CREATED,
        entityDisplayName: orderNumber,
        payload: {
          orderNumber,
          customerId: dto.customerId,
          customerName: customerObj?.name,
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
    const existing = await this.ordersQueryService.findOrder(id);

    if (
      existing.stateCode === SALES_ORDER_STATE.INVOICED ||
      existing.stateCode === SALES_ORDER_STATE.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot update order in state '${existing.stateCode}'`,
      );
    }

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      // Safely merge custom fields before calculating diff
      if (dto.customFields !== undefined) {
        dto.customFields = {
          ...(existing.customFields as object),
          ...dto.customFields,
        };
      }

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

        const [loc] = await tx
          .select({ name: locations.name })
          .from(locations)
          .where(
            eq(
              locations.locationId,
              audit.changes.fulfillmentLocationId as string,
            ),
          );
        if (loc) {
          audit.changes.fulfillmentLocation = loc.name;
          delete audit.changes.fulfillmentLocationId;
        }
      }

      if (audit.previousValues.fulfillmentLocationId) {
        const [loc] = await tx
          .select({ name: locations.name })
          .from(locations)
          .where(
            eq(
              locations.locationId,
              audit.previousValues.fulfillmentLocationId as string,
            ),
          );
        if (loc) {
          audit.previousValues.fulfillmentLocation = loc.name;
          delete audit.previousValues.fulfillmentLocationId;
        }
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
   * Archive an order.
   */
  async archive(id: string, actor: string) {
    const existing = await this.ordersQueryService.findOrder(id);

    if (
      existing.stateCode !== SALES_ORDER_STATE.INVOICED &&
      existing.stateCode !== SALES_ORDER_STATE.CANCELLED
    ) {
      throw new BadRequestException(
        `Order must be '${SALES_ORDER_STATE.INVOICED}' or '${SALES_ORDER_STATE.CANCELLED}' to be archived (current state: '${existing.stateCode}')`,
      );
    }

    return await this.orderStateService.changeSalesOrderState(
      id,
      SALES_ORDER_STATE.ARCHIVED,
      actor,
    );
  }

  /**
   * Unarchive an order.
   */
  async unarchive(id: string, actor: string) {
    const existing = await this.ordersQueryService.findOrder(id);

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

    return await this.orderStateService.changeSalesOrderState(
      id,
      previousState,
      actor,
    );
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
}

import { randomUUID } from 'crypto';
import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql, desc, and, gte, or, asc, lt, gt, ilike } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesInvoices,
  salesInvoiceLines,
  salesOrderLineItems,
  outbox,
  customers,
  glAccounts,
  products as coreProducts,
  customerGroups,
  productGroups,
  paymentEntries,
  paymentAllocations,
  glJournalEntries,
  glJournalLines,
  tradingTerms,
  systemEvents,
  salesOrderReturns,
  salesOrderReturnLines,
  inventoryLedger,
  actors,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { getExchangeRateForCurrency } from '../common/fx-helper';
import { buildUpdatePayload } from '../common/utils/drizzle-utils';
import { resolveGlDimensions } from '../common/utils/gl-resolution.util';
import { calculateDueDate } from '../settings/trading-terms.utils';
import {
  resolveEffectiveTradingTermsId,
  resolveEffectiveEarlyPaymentDiscount,
} from '../customers/credit-control.utils';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { getCommittedPerLine } from '../orders/shipment-helpers';
import { evaluateLifecycleRules } from '../orders/order-lifecycle-rules';
import {
  computeLinePrice,
  JOURNAL_ENTRY_SOURCE_TYPE,
  isStockedProductLine,
} from '@herobm/shared';
import { AppConfigService } from '../settings/app-config.service';
import { OrganizationService } from '../settings/organization.service';
import { EnrichmentService } from '../enrichment/enrichment.service';
import { CreateSalesInvoiceDto } from './dto';
import { withCursorPagination } from '../common/pagination';
import {
  SALES_INVOICE_STATE,
  SALES_INVOICE_TRANSITIONS,
  SALES_ORDER_STATE,
  SalesOrderState,
  getValidStates,
  getErrorMessage,
  RETURN_STATE,
} from '@herobm/shared';
import { getAvailableToInvoice } from '../orders/order-math.utils';

const VALID_INVOICE_STATES = getValidStates(SALES_INVOICE_TRANSITIONS);

@Injectable()
export class SalesInvoiceService {
  private readonly logger = new Logger(SalesInvoiceService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
    private readonly taxService: TaxCategoriesService,
    private readonly appConfig: AppConfigService,
    private readonly organizationService: OrganizationService,
    private readonly enrichmentService: EnrichmentService,
  ) {}

  /**
   * Generates a structural sequence number for the AR invoice natively in HeroBM.
   */
  private async generateInvoiceNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `INV-${today}-`;

    const result = await this.db
      .select({ invoiceNumber: salesInvoices.invoiceNumber })
      .from(salesInvoices)
      .where(sql`${salesInvoices.invoiceNumber} LIKE ${prefix + '%'}`)
      .orderBy(sql`${salesInvoices.invoiceNumber} DESC`)
      .limit(1);

    const seq =
      result.length > 0
        ? parseInt(result[0].invoiceNumber.replace(prefix, ''), 10) + 1
        : 1;

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /**
   * Transition a fully dispatched Sales Order directly into the natively Invoiced status.
   * Leverages transactional Outbox pattern to orchestrate async external GL mapping.
   */
  async createInvoice(
    salesOrderId: string,
    dto: CreateSalesInvoiceDto,
    actor: string,
  ) {
    // 1. Validate Order State strictly (must be shipped/dispatched)
    const orderRows = await this.db
      .select()
      .from(salesOrders)
      .where(eq(salesOrders.salesOrderId, salesOrderId))
      .limit(1);

    if (orderRows.length === 0) {
      throw new NotFoundException(`Order '${salesOrderId}' not found`);
    }

    const order = orderRows[0];
    if (
      !(
        [
          SALES_ORDER_STATE.SHIPPED,
          SALES_ORDER_STATE.PICKING,
          SALES_ORDER_STATE.CONFIRMED,
        ] as SalesOrderState[]
      ).includes(order.stateCode)
    ) {
      throw new BadRequestException(
        `Order ${order.orderNumber} must be in 'confirmed', 'picking', or 'shipped' state to generate an invoice. Currently: '${order.stateCode}'.`,
      );
    }

    // Identify if the Customer has an external ID mapped natively already dynamically
    let externalId: string | null = null;
    let customerName = 'Unknown Customer';
    let customerArAccountId: string | null = null;
    let customerRevenueAccountId: string | null = null;
    let customerCostCenterId: string | null = null;
    let customerActivityId: string | null = null;
    let billingAddressCountry: string | null = null;
    let billingAddressPostalCode: string | null = null;
    let billingAddressStateOrProvince: string | null = null;
    let billingAddressCity: string | null = null;
    let billingAddressLine1: string | null = null;
    let customerTermType: string | null = null;
    let customerTermDays: number | null = null;
    let customerTermDescription: string | null = null;
    let earlyPaymentDiscount: string | null = null;
    let earlyPaymentDiscountDays: number | null = null;

    if (order.customerId) {
      // Find Party details to bind
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          order.customerId,
        );

      const custRows = await this.db
        .select({
          externalId: customers.externalId,
          name: actors.name,
          defaultArAccountId: customerGroups.defaultArAccountId,
          defaultRevenueAccountId: customerGroups.defaultRevenueAccountId,
          defaultCostCenterId: customerGroups.defaultCostCenterId,
          defaultActivityId: customerGroups.defaultActivityId,
          creditLimit: customers.creditLimit,
          isOnCreditHold: customers.isOnCreditHold,
          tradingTermsId: customers.tradingTermsId,
          earlyPaymentDiscount: customers.earlyPaymentDiscount,
          earlyPaymentDiscountDays: customers.earlyPaymentDiscountDays,
          groupCreditLimit: customerGroups.creditLimit,
          groupIsOnCreditHold: customerGroups.isOnCreditHold,
          groupTradingTermsId: customerGroups.tradingTermsId,
          groupEarlyPaymentDiscount: customerGroups.earlyPaymentDiscount,
          groupEarlyPaymentDiscountDays:
            customerGroups.earlyPaymentDiscountDays,
        })
        .from(customers)
        .leftJoin(
          customerGroups,
          eq(customers.customerGroupId, customerGroups.customerGroupId),
        )
        .leftJoin(actors, eq(customers.actorId, actors.actorId))
        .where(
          isUuid
            ? eq(customers.customerId, order.customerId)
            : eq(customers.externalId, order.customerId),
        )
        .limit(1);

      if (custRows.length > 0) {
        externalId = custRows[0].externalId || '';
        customerName = custRows[0].name || 'Unknown Customer';
        customerArAccountId = custRows[0].defaultArAccountId;
        customerRevenueAccountId = custRows[0].defaultRevenueAccountId;
        customerCostCenterId = custRows[0].defaultCostCenterId;
        customerActivityId = custRows[0].defaultActivityId;
        billingAddressCountry = null;
        billingAddressPostalCode = null;
        billingAddressStateOrProvince = null;
        billingAddressCity = null;
        billingAddressLine1 = null;

        const effectiveEarlyPaymentDiscount =
          resolveEffectiveEarlyPaymentDiscount({
            earlyPaymentDiscount: custRows[0].earlyPaymentDiscount,
            earlyPaymentDiscountDays: custRows[0].earlyPaymentDiscountDays,
            customerGroup: {
              earlyPaymentDiscount: custRows[0].groupEarlyPaymentDiscount,
              earlyPaymentDiscountDays:
                custRows[0].groupEarlyPaymentDiscountDays,
            },
          });
        earlyPaymentDiscount =
          effectiveEarlyPaymentDiscount.earlyPaymentDiscount;
        earlyPaymentDiscountDays =
          effectiveEarlyPaymentDiscount.earlyPaymentDiscountDays;

        const effectiveTermsId = resolveEffectiveTradingTermsId({
          creditLimit: custRows[0].creditLimit,
          isOnCreditHold: custRows[0].isOnCreditHold ?? false,
          tradingTermsId: custRows[0].tradingTermsId,
          customerGroup: {
            creditLimit: custRows[0].groupCreditLimit,
            isOnCreditHold: custRows[0].groupIsOnCreditHold ?? false,
            tradingTermsId: custRows[0].groupTradingTermsId,
          },
          systemDefaultCustomerTermsId:
            this.appConfig.getAppSettingsRaw()?.defaultCustomerTermsId,
        });

        if (effectiveTermsId) {
          const [term] = await this.db
            .select()
            .from(tradingTerms)
            .where(eq(tradingTerms.tradingTermsId, effectiveTermsId))
            .limit(1);
          if (term) {
            customerTermType = term.type as
              | 'net'
              | 'end_of_month'
              | 'cash_on_delivery';
            customerTermDays = term.days;
            customerTermDescription = `${term.code} - ${term.description}`;
          }
        }
      }
    }

    // 2. Load the structural Sales Order Line dimensions to invoice explicitly
    const orderLines = await this.db
      .select({
        salesOrderLineId: salesOrderLineItems.salesOrderLineId,
        lineNumber: salesOrderLineItems.lineNumber,
        productId: salesOrderLineItems.productId,
        quantity: salesOrderLineItems.quantity,
        pricePerUnit: salesOrderLineItems.pricePerUnit,
        discountPercentage: salesOrderLineItems.discountPercentage,
        taxCategoryId: salesOrderLineItems.taxCategoryId,
        productType: coreProducts.productType,
        productRevenueAccountId: productGroups.defaultRevenueAccountId,
        productCostCenterId: productGroups.defaultCostCenterId,
        productActivityId: productGroups.defaultActivityId,
        externalTaxCode: coreProducts.externalTaxCode,
        productNumber: coreProducts.productNumber,
      })
      .from(salesOrderLineItems)
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .leftJoin(
        productGroups,
        eq(coreProducts.productGroupId, productGroups.productGroupId),
      )
      .where(eq(salesOrderLineItems.salesOrderId, salesOrderId));

    if (orderLines.length === 0) {
      throw new BadRequestException('Cannot invoice an empty order.');
    }

    const invoiceNumber = await this.generateInvoiceNumber();

    // Fetch previously invoiced lines for this order natively
    const priorInvoices = await this.db
      .select({
        salesOrderLineId: salesInvoiceLines.salesOrderLineId,
        quantityInvoiced: salesInvoiceLines.quantityInvoiced,
      })
      .from(salesInvoiceLines)
      .innerJoin(
        salesInvoices,
        eq(salesInvoiceLines.invoiceId, salesInvoices.invoiceId),
      )
      .where(eq(salesInvoices.salesOrderId, salesOrderId));

    const invoicedQtyByLine = new Map<string, number>();
    for (const invLine of priorInvoices) {
      const current = invoicedQtyByLine.get(invLine.salesOrderLineId) || 0;
      invoicedQtyByLine.set(
        invLine.salesOrderLineId,
        current + parseFloat(invLine.quantityInvoiced),
      );
    }

    // Fetch shipped quantities strictly natively to enforce invoicing bounds
    const shippedQtyMap = await getCommittedPerLine(this.db, salesOrderId);

    // Fetch processed refunds to ensure we do not over-invoice
    const processedRefunds = await this.db
      .select({
        salesOrderLineId: salesOrderReturnLines.salesOrderLineId,
        quantityReturned: salesOrderReturnLines.quantityReturned,
      })
      .from(salesOrderReturnLines)
      .innerJoin(
        salesOrderReturns,
        eq(salesOrderReturnLines.returnId, salesOrderReturns.returnId),
      )
      .where(
        and(
          eq(salesOrderReturns.salesOrderId, salesOrderId),
          eq(salesOrderReturns.stateCode, RETURN_STATE.PROCESSED),
          eq(salesOrderReturnLines.resolution, 'refund'),
        ),
      );

    const refundedQtyByLine = new Map<string, number>();
    for (const retLine of processedRefunds) {
      const current = refundedQtyByLine.get(retLine.salesOrderLineId) || 0;
      refundedQtyByLine.set(
        retLine.salesOrderLineId,
        current + parseFloat(retLine.quantityReturned),
      );
    }

    // 3. Compute the strictly typed AR payload bounds natively
    let rawTotal = 0;
    let rawTax = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle insert types are too complex to infer for mapped rows
    const invoiceLineValues: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle insert types are too complex to infer for mapped rows
    const outboxLineDetails: any[] = [];

    // Revenue GL Routing tallies — keyed by composite (customerId|costCenterId|activityId)
    const revenueGroups = new Map<
      string,
      {
        customerId: string;
        amount: number;
        costCenterId: string | null;
        activityId: string | null;
      }
    >();
    const taxGroups = new Map<string, number>(); // glAccountId -> amount
    let defaultRevenue = 0;
    let defaultRevenueCostCenterId: string | null = null;
    let defaultRevenueActivityId: string | null = null;

    let totalOrderedQty = 0;
    let totalInvoicedSoFar = 0;
    let totalInvoicingNow = 0;

    for (const line of orderLines) {
      const orderedQty = parseFloat(line.quantity);
      totalOrderedQty += orderedQty;

      const prevInvoicedQty = invoicedQtyByLine.get(line.salesOrderLineId) || 0;
      totalInvoicedSoFar += prevInvoicedQty;

      const isStocked = isStockedProductLine({
        productId: line.productId,
        productType: line.productType,
      });
      let shippedQty = shippedQtyMap.get(line.salesOrderLineId) || 0;

      if (!isStocked) {
        // Non-stock, service, and custom products can be invoiced at any time, up to their ordered quantity
        shippedQty = orderedQty;
      }

      const refundedQty = refundedQtyByLine.get(line.salesOrderLineId) || 0;

      // Determine how much to invoice dynamically
      let qtyToInvoice = 0;
      if (dto.lines) {
        const reqLine = dto.lines.find(
          (l) => l.salesOrderLineId === line.salesOrderLineId,
        );
        qtyToInvoice = reqLine ? reqLine.quantityToInvoice : 0;
      } else {
        // Default fallback logic natively caps at strictly the shipped quantities minus invoiced and refunded
        qtyToInvoice = getAvailableToInvoice(
          shippedQty,
          prevInvoicedQty,
          refundedQty,
        );
      }

      if (qtyToInvoice <= 0) {
        continue;
      }

      // We allow strict bounds locally natively
      // If there are rounding issues we may need to tune this, but mathematically
      // we check for precision mathematically:
      const availableToInvoice = getAvailableToInvoice(
        shippedQty,
        prevInvoicedQty,
        refundedQty,
      );
      if (qtyToInvoice > availableToInvoice + 0.001) {
        throw new BadRequestException(
          `Cannot invoice more than available quantity for line ${line.lineNumber}. Requested: ${qtyToInvoice}, Remaining: ${availableToInvoice}`,
        );
      }

      totalInvoicingNow += qtyToInvoice;

      const price = parseFloat(line.pricePerUnit);
      const disc = parseFloat(line.discountPercentage ?? '0');

      // Resolve GST rate from the line's category (not the stored tax dollar amount)
      let taxRate = 0;
      let lineSalesTaxAcctId: string | null = null;
      if (line.taxCategoryId) {
        try {
          const cat = await this.taxService.getById(line.taxCategoryId);
          taxRate = parseFloat(cat.rate ?? '0');
          lineSalesTaxAcctId = cat.salesGlAccountId;
        } catch (err: unknown) {
          if (err instanceof NotFoundException) {
            // Category not found — fall back to 0% tax
          } else {
            throw err;
          }
        }
      }

      const pricing = computeLinePrice({
        quantity: qtyToInvoice,
        pricePerUnit: price,
        discountPercentage: disc,
        taxRate: taxRate,
      });

      rawTotal += pricing.amount;
      rawTax += pricing.tax;

      if (pricing.tax > 0) {
        const effTaxGl =
          lineSalesTaxAcctId ||
          this.appConfig.defaultSalesTaxAccountId() ||
          'fallback';
        taxGroups.set(effTaxGl, (taxGroups.get(effTaxGl) || 0) + pricing.tax);
      }

      const sysDefaultRevAcct = this.appConfig.defaultRevenueAccountId();
      const sysDefaultCC = this.appConfig.defaultCostCenterId();
      const sysDefaultAct = this.appConfig.defaultActivityId();

      const customerDims = {
        accountId: customerRevenueAccountId,
        costCenterId: customerCostCenterId,
        activityId: customerActivityId,
      };

      const productDims = {
        accountId: line.productRevenueAccountId,
        costCenterId: line.productCostCenterId,
        activityId: line.productActivityId,
      };

      const {
        accountId: lineRevAcctId,
        costCenterId: lineCostCenterId,
        activityId: lineActivityId,
      } = resolveGlDimensions(
        this.appConfig.revenueRoutingPrecedence() === 'customer_first'
          ? customerDims
          : productDims,
        this.appConfig.revenueRoutingPrecedence() === 'customer_first'
          ? productDims
          : customerDims,
        {
          defaultAccountId: sysDefaultRevAcct,
          defaultCostCenterId: sysDefaultCC,
          defaultActivityId: sysDefaultAct,
        },
      );

      if (lineRevAcctId) {
        const compositeKey = `${lineRevAcctId}|${lineCostCenterId || ''}|${lineActivityId || ''}`;
        const existing = revenueGroups.get(compositeKey);
        if (existing) {
          existing.amount += pricing.amount;
        } else {
          revenueGroups.set(compositeKey, {
            customerId: lineRevAcctId,
            amount: pricing.amount,
            costCenterId: lineCostCenterId,
            activityId: lineActivityId,
          });
        }
      } else {
        defaultRevenue += pricing.amount;
        // Keep track of last resolved dimension for the default fallback bucket
        defaultRevenueCostCenterId =
          defaultRevenueCostCenterId || lineCostCenterId;
        defaultRevenueActivityId = defaultRevenueActivityId || lineActivityId;
      }

      invoiceLineValues.push({
        salesOrderLineId: line.salesOrderLineId,
        quantityInvoiced: String(qtyToInvoice),
        pricePerUnit: String(price),
        amount: String(pricing.amount),
      });

      outboxLineDetails.push({
        salesOrderLineId: line.salesOrderLineId,
        productId: line.productId,
        quantity: qtyToInvoice,
        amount: pricing.amount,
        tax: pricing.tax,
        taxCategoryId: line.taxCategoryId,
        externalTaxCode: line.externalTaxCode,
        discountPercentage: disc,
        pricePerUnit: price,
        productType: line.productType,
      });
    }

    if (invoiceLineValues.length === 0) {
      throw new BadRequestException(
        'No quantities available to invoice, or invalid quantities provided.',
      );
    }

    const totalAmount = rawTotal;
    const taxAmount = rawTax;
    const combinedTotal = totalAmount + taxAmount;

    // Check strict transition bound tolerance cleanly using floating point fallback mathematically
    const isFullyInvoiced =
      totalInvoicedSoFar + totalInvoicingNow >= totalOrderedQty - 0.001;

    // 4. Begin transactional generation (invoice + GL posting are atomic)
    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const invoiceDate = new Date();
      let dueDate = new Date();
      if (customerTermType && customerTermDays !== null) {
        dueDate = calculateDueDate(
          invoiceDate,
          customerTermType,
          customerTermDays,
        );
      }

      const fx = await getExchangeRateForCurrency(
        tx,
        order.currencyCode,
        invoiceDate,
      );
      const baseTotalAmount = (combinedTotal * fx.rate).toFixed(2);

      const [invoice] = await tx
        .insert(salesInvoices)
        .values({
          invoiceId: randomUUID(),
          invoiceNumber,
          salesOrderId,
          customerOrderNumber: order.customerOrderNumber,
          totalAmount: String(combinedTotal), // AR takes the whole amount dynamically
          outstandingAmount: String(combinedTotal),
          taxAmount: String(taxAmount),
          baseTotalAmount: baseTotalAmount,
          baseOutstandingAmount: baseTotalAmount,
          currencyCode: order.currencyCode,
          exchangeRate: fx.rate.toString(),
          stateCode: SALES_INVOICE_STATE.DRAFT, // Start in draft and then transition
          notes: dto.notes,
          termsDescription: customerTermDescription,
          invoiceDate,
          dueDate,
          earlyPaymentDiscount,
          earlyPaymentDiscountDays,
          createdBy: actor,
        })
        .returning();

      const invoicedInvoice = await this.changeSalesInvoiceState(
        invoice.invoiceId,
        SALES_INVOICE_STATE.INVOICED,
        actor,
        tx,
      );

      // B. Structure local Invoice Details mapping natively
      const preparedLines = invoiceLineValues.map((l) => ({
        ...l,
        invoiceId: invoice.invoiceId,
      }));
      await tx.insert(salesInvoiceLines).values(preparedLines);

      // C. Transition originating Order cleanly
      // Handled by evaluateLifecycleRules after the transaction

      // D. Generate specific Outbox Sync Event asynchronously routing back
      const outboxPayload = {
        invoiceId: invoice.invoiceId,
        invoiceNumber,
        salesOrderId,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName: customerName,
        externalId: externalId,
        totalRevenue: totalAmount,
        totalTax: taxAmount,
        totalAccountsReceivable: combinedTotal,
        currency: order.currencyCode,
        lines: outboxLineDetails,
      };

      await emitEvent(tx, {
        entityType: EntityType.SALES_ORDER,
        entityId: salesOrderId,
        eventType: EventType.SALES_INVOICED,
        entityDisplayName: order.orderNumber,
        payload: outboxPayload,
        actor,
      });

      // E. Post GL journal entry (atomic with invoice creation)
      const settings = await this.glService.getSettings(tx);
      const effectiveArAccountId =
        customerArAccountId || settings?.defaultArAccountId;

      if (!effectiveArAccountId) {
        throw new BadRequestException(
          'Cannot create invoice: Accounts Receivable account (defaultArAccountId) is not configured in GL Settings.',
        );
      }

      // Collect all distinct Customer IDs logically needed
      const distinctAccountIds = new Set<string>();
      distinctAccountIds.add(effectiveArAccountId);
      if (settings?.defaultSalesTaxAccountId)
        distinctAccountIds.add(settings.defaultSalesTaxAccountId);
      for (const acctId of taxGroups.keys()) {
        if (acctId !== 'fallback') {
          distinctAccountIds.add(acctId);
        }
      }
      if (settings?.defaultRevenueAccountId)
        distinctAccountIds.add(settings.defaultRevenueAccountId);
      for (const group of revenueGroups.values()) {
        distinctAccountIds.add(group.customerId);
      }

      const settingsIds = Array.from(distinctAccountIds).filter(Boolean);

      const glAcct = glAccounts;
      const acctRows =
        settingsIds.length > 0
          ? await tx
              .select({
                glAccountId: glAcct.glAccountId,
                accountCode: glAcct.accountCode,
              })
              .from(glAcct)
              .where(
                sql`${glAcct.glAccountId} IN (${sql.join(
                  settingsIds.map((id) => sql`${id}`),
                  sql`, `,
                )})`,
              )
          : [];

      const idToCode = new Map(
        acctRows.map((a) => [a.glAccountId, a.accountCode]),
      );

      const arCode = idToCode.get(effectiveArAccountId);
      if (!arCode) {
        throw new BadRequestException(
          `Cannot create invoice: Accounts Receivable account '${effectiveArAccountId}' not found in Chart of Accounts.`,
        );
      }

      const taxCode = settings?.defaultSalesTaxAccountId
        ? idToCode.get(settings.defaultSalesTaxAccountId)
        : null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      const glLines: any[] = [
        {
          accountCode: arCode,
          debit: combinedTotal * fx.rate,
          credit: 0,
          foreignCurrency: order.currencyCode,
          foreignDebit: combinedTotal,
          foreignCredit: 0,
          memo: `AR: ${invoiceNumber}`,
          partyType: 'customer',
          partyId: order.customerId,
          costCenterId:
            customerCostCenterId ||
            this.appConfig.defaultCostCenterId() ||
            undefined,
          activityId:
            customerActivityId ||
            this.appConfig.defaultActivityId() ||
            undefined,
        },
      ];

      // 1. Map explicitly dynamic revenue lines (grouped by customer + dimensions)
      for (const group of revenueGroups.values()) {
        const code = idToCode.get(group.customerId);
        if (code && group.amount > 0) {
          glLines.push({
            accountCode: code,
            debit: 0,
            credit: group.amount * fx.rate,
            foreignCurrency: order.currencyCode,
            foreignDebit: 0,
            foreignCredit: group.amount,
            memo: `Revenue: ${invoiceNumber}`,
            costCenterId: group.costCenterId || undefined,
            activityId: group.activityId || undefined,
          });
        }
      }

      // 2. Map default global revenue fallback sum
      if (defaultRevenue > 0) {
        const defCode = settings?.defaultRevenueAccountId
          ? idToCode.get(settings.defaultRevenueAccountId)
          : null;

        if (!defCode) {
          throw new BadRequestException(
            'Cannot create invoice: Default Revenue account (defaultRevenueAccountId) is not configured in GL Settings.',
          );
        }

        glLines.push({
          accountCode: defCode,
          debit: 0,
          credit: defaultRevenue * fx.rate,
          foreignCurrency: order.currencyCode,
          foreignDebit: 0,
          foreignCredit: defaultRevenue,
          memo: `Revenue: ${invoiceNumber} (Default)`,
          costCenterId: defaultRevenueCostCenterId || undefined,
          activityId: defaultRevenueActivityId || undefined,
        });
      }

      for (const [acctId, taxAmt] of taxGroups.entries()) {
        if (taxAmt > 0) {
          const effectiveTaxCode =
            acctId !== 'fallback' ? idToCode.get(acctId) : taxCode;
          if (!effectiveTaxCode) {
            throw new BadRequestException(
              'Cannot create invoice: Sales Tax account (defaultSalesTaxAccountId) is not configured in GL Settings.',
            );
          }

          glLines.push({
            accountCode: effectiveTaxCode,
            debit: 0,
            credit: taxAmt * fx.rate,
            foreignCurrency: order.currencyCode,
            foreignDebit: 0,
            foreignCredit: taxAmt,
            memo: `GST: ${invoiceNumber}`,
          });
        }
      }

      await this.glService.postJournalEntry(
        glLines,
        {
          sourceType: JOURNAL_ENTRY_SOURCE_TYPE.SALES_INVOICE,
          sourceId: invoice.invoiceId,
          memo: `Sales invoice ${invoiceNumber} for order ${order.orderNumber}`,
          actor,
        },
        tx,
      );

      this.logger.log(`GL journal posted for sales invoice ${invoiceNumber}`);

      // F. Record Transaction in External Engine if applicable
      const mappings = this.appConfig.taxProviderMappings();
      const orderTaxProvider =
        mappings[billingAddressCountry || 'US'] || 'internal';

      if (
        orderTaxProvider &&
        orderTaxProvider !== 'internal' &&
        !orderTaxProvider.endsWith('-error')
      ) {
        const org = await this.organizationService.get();

        const freightLines = outboxLineDetails.filter(
          (l) => l.productType === 'freight',
        );
        const taxableLines = outboxLineDetails.filter(
          (l) => l.productType !== 'freight',
        );

        const shippingTotal = freightLines.reduce((sum, l) => {
          const discountAmt =
            l.pricePerUnit * (l.discountPercentage / 100) * l.quantity;
          return sum + l.quantity * l.pricePerUnit - discountAmt;
        }, 0);

        const payload = {
          transaction_id: invoice.invoiceId,
          transaction_date: new Date().toISOString(),
          amount: totalAmount,
          shipping: shippingTotal,
          sales_tax: taxAmount,
          from_country: org.country || 'US',
          from_zip: org.postCode,
          from_state: org.state,
          from_city: org.city,
          from_street: org.addressLine1,
          to_country: billingAddressCountry || undefined,
          to_zip: billingAddressPostalCode || undefined,
          to_state: billingAddressStateOrProvince || undefined,
          to_city: billingAddressCity || undefined,
          to_street: billingAddressLine1 || undefined,
          line_items: taxableLines.map((l) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
            const payloadLine: any = {
              id: l.salesOrderLineId,
              product_identifier: l.productNumber,
              description: l.productDescription,
              quantity: l.quantity,
              unit_price: l.pricePerUnit,
              discount:
                l.pricePerUnit * (l.discountPercentage / 100) * l.quantity,
              sales_tax: l.tax,
            };
            if (l.externalTaxCode) {
              payloadLine.product_tax_code = l.externalTaxCode;
            }
            return payloadLine;
          }),
        };
        try {
          const enrichRes = await this.enrichmentService.recordTransaction(
            orderTaxProvider,
            payload,
          );
          if (!enrichRes.isValid) {
            throw new BadRequestException(
              `Tax provider rejected transaction: ${String(enrichRes.data?.error)}`,
            );
          }
          this.logger.log(
            `Transaction recorded in ${orderTaxProvider} for invoice ${invoiceNumber}`,
          );
        } catch (e: unknown) {
          this.logger.error(
            `Failed to record transaction in ${orderTaxProvider}`,
            e,
          );
          throw new BadRequestException(
            `Failed to record transaction in ${orderTaxProvider}: ${getErrorMessage(e)}`,
          );
        }
      }

      return invoicedInvoice;
    });

    this.logger.log(
      `Native Sales Invoice created: ${invoiceNumber} for order ${order.orderNumber} strictly mapping AR boundary`,
    );

    // Evaluate lifecycle rules to auto-transition the Sales Order if needed
    try {
      await evaluateLifecycleRules(
        this.db,
        salesOrderId,
        {
          entity: 'sales_invoice',
          action: 'created',
          id: result.invoiceId,
        },
        actor,
      );
    } catch (err) {
      this.logger.error(
        `Failed to evaluate lifecycle rules for SO ${salesOrderId} after invoice creation:`,
        err,
      );
    }

    return result;
  }

  /**
   * Fetch a specific HeroBM Sales Invoice with natively populated mappings structurally
   */
  async findOne(invoiceId: string) {
    const rows = await this.db
      .select({
        invoiceId: salesInvoices.invoiceId,
        invoiceNumber: salesInvoices.invoiceNumber,
        customerOrderNumber: sql<
          string | null
        >`COALESCE(${salesInvoices.customerOrderNumber}, ${salesOrders.customerOrderNumber})`.as(
          'customer_order_number',
        ),
        salesOrderId: salesInvoices.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        customerId: sql<
          string | null
        >`COALESCE(${salesInvoices.customerId}, ${salesOrders.customerId})`.as(
          'customer_id',
        ),
        customerName: sql<
          string | null
        >`COALESCE(${salesInvoices.customerNameDisplay}, ${actors.name})`.as(
          'customer_name',
        ),
        totalAmount: salesInvoices.totalAmount,
        taxAmount: salesInvoices.taxAmount,
        outstandingAmount: salesInvoices.outstandingAmount,
        currencyCode: salesInvoices.currencyCode,
        stateCode: salesInvoices.stateCode,
        createdOn: salesInvoices.createdOn,
        dueDate: salesInvoices.dueDate,
        invoiceDate: salesInvoices.invoiceDate,
        notes: salesInvoices.notes,
        earlyPaymentDiscount: salesInvoices.earlyPaymentDiscount,
        earlyPaymentDiscountDays: salesInvoices.earlyPaymentDiscountDays,
        termsDescription: salesInvoices.termsDescription,
      })
      .from(salesInvoices)
      .innerJoin(
        salesOrders,
        eq(salesInvoices.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(
        customers,
        eq(
          sql`COALESCE(${salesInvoices.customerId}, ${salesOrders.customerId})`,
          customers.customerId,
        ),
      )
      .leftJoin(actors, eq(customers.actorId, actors.actorId))
      .where(eq(salesInvoices.invoiceId, invoiceId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Invoice '${invoiceId}' not found directly.`);
    }

    const invoice = rows[0];

    // Hydrate explicitly native HeroBM line mapping structurally
    const lines = await this.db
      .select({
        lineId: salesInvoiceLines.invoiceLineId,
        quantityInvoiced: salesInvoiceLines.quantityInvoiced,
        pricePerUnit: salesInvoiceLines.pricePerUnit,
        amount: salesInvoiceLines.amount,
        productId: salesOrderLineItems.productId,
        productNumber: coreProducts.productNumber,
        description: sql<string>`COALESCE(${salesOrderLineItems.productDescription}, ${coreProducts.name})`,
      })
      .from(salesInvoiceLines)
      .innerJoin(
        salesOrderLineItems,
        eq(
          salesInvoiceLines.salesOrderLineId,
          salesOrderLineItems.salesOrderLineId,
        ),
      )
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .where(eq(salesInvoiceLines.invoiceId, invoiceId));

    const allocations = await this.db
      .select({
        allocationId: paymentAllocations.allocationId,
        allocatedAmount: paymentAllocations.allocatedAmount,
        paymentId: paymentAllocations.paymentId,
        paymentNumber: paymentEntries.paymentNumber,
        paymentDate: paymentEntries.paymentDate,
        currencyCode: paymentEntries.currencyCode,
      })
      .from(paymentAllocations)
      .innerJoin(
        paymentEntries,
        eq(paymentAllocations.paymentId, paymentEntries.paymentId),
      )
      .where(
        and(
          eq(paymentAllocations.referenceId, invoiceId),
          eq(paymentAllocations.referenceType, 'sales_invoice'),
        ),
      );

    const events = await this.db
      .select()
      .from(systemEvents)
      .where(eq(systemEvents.entityId, invoiceId))
      .orderBy(desc(systemEvents.createdOn));

    return { ...invoice, lines, allocations, events };
  }

  /**
   * Fetch all Native HeroBM Invoices strictly tied to a distinct active order
   */
  async findByOrder(salesOrderId: string) {
    const invoices = await this.db
      .select()
      .from(salesInvoices)
      .where(eq(salesInvoices.salesOrderId, salesOrderId))
      .orderBy(desc(salesInvoices.createdOn));

    // Hydrate lines for each invoice
    if (invoices.length === 0) return [];

    const invoiceIds = invoices.map((i) => i.invoiceId);
    if (invoiceIds.length > 0) {
      const allLines = await this.db
        .select({
          lineId: salesInvoiceLines.invoiceLineId,
          invoiceId: salesInvoiceLines.invoiceId,
          salesOrderLineId: salesInvoiceLines.salesOrderLineId,
          quantityInvoiced: salesInvoiceLines.quantityInvoiced,
          pricePerUnit: salesInvoiceLines.pricePerUnit,
          amount: salesInvoiceLines.amount,
        })
        .from(salesInvoiceLines)
        .where(
          sql`${salesInvoiceLines.invoiceId} IN (${sql.join(
            invoiceIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic grouping of raw DB results
      const groupedLines: Record<string, any[]> = {};
      for (const line of allLines) {
        if (!groupedLines[line.invoiceId]) {
          groupedLines[line.invoiceId] = [];
        }
        groupedLines[line.invoiceId].push(line);
      }

      return invoices.map((inv) => ({
        ...inv,
        lines: groupedLines[inv.invoiceId] || [],
      }));
    }

    return invoices;
  }

  /**
   * Fetch a flattened, global list of Sales Invoices spanning multiple orders.
   * Useful for the "All Invoices" page and Customer Detail tabs.
   */
  async findActiveInvoices(query: {
    days?: number | string;
    customerId?: string;
    invoiceId?: string;
    balanceStatus?: string;
    limit?: number;
    cursor?: unknown;
    direction?: 'next' | 'prev';
    searchTerm?: string | null;
  }) {
    const {
      days = 30,
      customerId,
      invoiceId,
      balanceStatus,
      limit = 100,
      cursor,
      direction = 'next',
      searchTerm,
    } = query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle SQL operators array typing
    const conditions: any[] = [];

    // When filtering by specific invoiceId, skip the date range filter
    if (invoiceId) {
      conditions.push(eq(salesInvoices.invoiceId, invoiceId));
    } else if (String(days).toLowerCase() === 'mtd') {
      conditions.push(
        sql`${salesInvoices.createdOn} >= DATE_TRUNC('month', NOW())`,
      );
    } else if (Number(days) > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - Number(days));
      conditions.push(gte(salesInvoices.createdOn, cutoffDate));
    }

    if (customerId) {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          customerId,
        );

      if (isUuid) {
        conditions.push(
          or(
            eq(customers.customerId, customerId),
            eq(customers.externalId, customerId),
          ),
        );
      } else {
        conditions.push(eq(customers.externalId, customerId));
      }
    }

    if (balanceStatus === 'unpaid') {
      conditions.push(sql`${salesInvoices.outstandingAmount}::numeric > 0`);
    } else if (balanceStatus === 'paid') {
      conditions.push(sql`${salesInvoices.outstandingAmount}::numeric <= 0`);
    }

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${salesInvoices.invoiceNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${salesInvoices.invoiceNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${salesOrders.orderNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${salesOrders.orderNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${actors.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${actors.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    if (searchTerm) {
      conditions.push(
        or(
          ilike(salesInvoices.invoiceNumber, `%${rawSearchTerm}%`),
          ilike(salesOrders.orderNumber, `%${rawSearchTerm}%`),
          ilike(actors.name, `%${rawSearchTerm}%`),
        ) as import('drizzle-orm').SQL,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let dataQuery = this.db
      .select({
        invoiceId: salesInvoices.invoiceId,
        invoiceNumber: salesInvoices.invoiceNumber,
        customerOrderNumber: sql<
          string | null
        >`COALESCE(${salesInvoices.customerOrderNumber}, ${salesOrders.customerOrderNumber})`.as(
          'customer_order_number',
        ),
        salesOrderId: salesInvoices.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        customerId: sql<
          string | null
        >`COALESCE(${salesInvoices.customerId}, ${salesOrders.customerId})`.as(
          'customer_id',
        ),
        customerName: sql<
          string | null
        >`COALESCE(${salesInvoices.customerNameDisplay}, ${actors.name})`.as(
          'customer_name',
        ),
        totalAmount: salesInvoices.totalAmount,
        taxAmount: salesInvoices.taxAmount,
        outstandingAmount: salesInvoices.outstandingAmount,
        currencyCode: salesInvoices.currencyCode,
        stateCode: salesInvoices.stateCode,
        createdOn: salesInvoices.createdOn,
        earlyPaymentDiscount: salesInvoices.earlyPaymentDiscount,
        earlyPaymentDiscountDays: salesInvoices.earlyPaymentDiscountDays,
        score: scoreSql,
      })
      .from(salesInvoices)
      .leftJoin(
        salesOrders,
        eq(salesInvoices.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(
        customers,
        eq(
          sql`COALESCE(${salesInvoices.customerId}, ${salesOrders.customerId})`,
          customers.customerId,
        ),
      )
      .leftJoin(actors, eq(customers.actorId, actors.actorId))
      .$dynamic();

    if (whereClause) {
      dataQuery = dataQuery.where(whereClause);
    }

    return await withCursorPagination({
      qb: dataQuery,
      limit,
      cursorObj: cursor as {
        score: number;
        createdOn: string;
        invoiceId: string;
      } | null,
      direction,
      applyWhere: (q, c, dir) => {
        const op = dir === 'next' ? lt : gt;
        const cursorCond = or(
          op(scoreSql, c.score),
          and(
            eq(scoreSql, c.score),
            op(salesInvoices.createdOn, new Date(c.createdOn)),
          ),
          and(
            eq(scoreSql, c.score),
            eq(salesInvoices.createdOn, new Date(c.createdOn)),
            op(salesInvoices.invoiceId, c.invoiceId),
          ),
        ) as import('drizzle-orm').SQL;
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const op = dir === 'next' ? desc : asc;
        return q.orderBy(
          op(scoreSql),
          op(salesInvoices.createdOn),
          op(salesInvoices.invoiceId),
        );
      },
      encodeRow: (row) => ({
        score: Number(row.score) || 0,
        createdOn: row.createdOn
          ? new Date(row.createdOn).toISOString()
          : new Date().toISOString(),
        invoiceId: row.invoiceId,
      }),
    });
  }
  async changeSalesInvoiceState(
    invoiceId: string,
    newState: string,
    actor: string,
    tx?: DrizzleDB,
  ) {
    if (!VALID_INVOICE_STATES.includes(newState)) {
      throw new BadRequestException(`Invalid invoice state: '${newState}'`);
    }

    const execute = async (db: DrizzleDB) => {
      const [existing] = await db
        .select({
          stateCode: salesInvoices.stateCode,
          invoiceNumber: salesInvoices.invoiceNumber,
          salesOrderId: salesInvoices.salesOrderId,
        })
        .from(salesInvoices)
        .where(eq(salesInvoices.invoiceId, invoiceId))
        .for('update')
        .limit(1);

      if (!existing) {
        throw new NotFoundException(`Invoice ${invoiceId} not found`);
      }

      const allowed = SALES_INVOICE_TRANSITIONS[existing.stateCode];
      if (!allowed || !allowed.includes(newState)) {
        throw new BadRequestException(
          `Cannot transition invoice from '${existing.stateCode}' to '${newState}'. Allowed transitions: ${allowed?.join(', ') || 'none'}`,
        );
      }

      // If transitioning to CANCELLED, we must reverse the associated GL entries synchronously
      if (newState === SALES_INVOICE_STATE.CANCELLED) {
        const [originalEntry] = await db
          .select()
          .from(glJournalEntries)
          .where(
            and(
              eq(glJournalEntries.sourceType, 'sales_invoice'),
              eq(glJournalEntries.sourceId, invoiceId),
            ),
          )
          .limit(1);

        if (originalEntry) {
          const originalLines = await db
            .select()
            .from(glJournalLines)
            .where(
              eq(glJournalLines.journalEntryId, originalEntry.journalEntryId),
            );

          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
          const reversedLines: any[] = originalLines.map((line) => ({
            accountId: line.glAccountId,
            debit: parseFloat(line.credit),
            credit: parseFloat(line.debit),
            memo: `Cancellation Reversal: ${line.memo}`,
            costCenterId: line.costCenterId,
            activityId: line.activityId,
            partyType: line.partyType,
            partyId: line.partyId,
          }));

          await this.glService.postJournalEntry(
            reversedLines,
            {
              sourceId: invoiceId,
              sourceType: JOURNAL_ENTRY_SOURCE_TYPE.SALES_INVOICE_REVERSAL,
              memo: `Reversal of Sales Invoice ${existing.invoiceNumber}`,
              entryDate: new Date().toISOString().slice(0, 10),
              actor,
            },
            db,
          );
        }
      }

      const [updated] = await db
        .update(salesInvoices) // @herobm-skip-audit
        .set({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- State codes often differ slightly from the strict Drizzle enums
          stateCode: newState as any,
          modifiedOn: new Date(),
        })
        .where(eq(salesInvoices.invoiceId, invoiceId))
        .returning();

      await emitEvent(db as unknown as DrizzleDB, {
        entityType: EntityType.SALES_INVOICE,
        entityId: invoiceId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: existing.invoiceNumber,
        payload: {
          entity: 'sales_invoice',
          entityId: invoiceId,
          invoiceNumber: existing.invoiceNumber,
          from: existing.stateCode,
          to: newState,
        },
        actor,
      });

      if (newState === SALES_INVOICE_STATE.CANCELLED && existing.salesOrderId) {
        try {
          await evaluateLifecycleRules(
            db,
            existing.salesOrderId,
            {
              entity: 'sales_invoice',
              action: 'cancelled',
              id: invoiceId,
            },
            actor,
          );
        } catch (lifecycleErr) {
          this.logger.error(
            `Failed to evaluate lifecycle rules for SO ${existing.salesOrderId} after invoice cancellation:`,
            lifecycleErr,
          );
        }
      }

      return updated;
    };

    if (tx) {
      return await execute(tx);
    } else {
      return await this.db.transaction(execute);
    }
  }

  async adminMarkPaid(invoiceId: string, actor: string) {
    return await this.db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(salesInvoices)
        .where(eq(salesInvoices.invoiceId, invoiceId))
        .limit(1);

      if (!invoice) {
        throw new NotFoundException(`Invoice ${invoiceId} not found`);
      }

      if (
        invoice.stateCode === SALES_INVOICE_STATE.PAID ||
        invoice.stateCode === SALES_INVOICE_STATE.CANCELLED
      ) {
        throw new BadRequestException(
          `Cannot mark invoice as paid. Invoice is currently '${invoice.stateCode}'.`,
        );
      }

      const [updated] = await tx
        .update(salesInvoices)
        .set({
          // eslint-disable-next-line no-restricted-syntax -- Administrative override to bypass standard state machine logic
          stateCode: SALES_INVOICE_STATE.PAID,
          outstandingAmount: '0',
          baseOutstandingAmount: '0',
          modifiedOn: new Date(),
        })
        .where(eq(salesInvoices.invoiceId, invoiceId))
        .returning();

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.SALES_INVOICE,
        entityId: invoiceId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: invoice.invoiceNumber,
        payload: {
          entity: 'sales_invoice',
          entityId: invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          from: invoice.stateCode,
          to: SALES_INVOICE_STATE.PAID,
          note: 'Administrative override: Invoice manually marked as paid without GL impact',
        },
        actor,
      });

      return updated;
    });
  }
}

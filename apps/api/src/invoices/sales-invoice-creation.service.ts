import { randomUUID } from 'crypto';
import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql, and } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesInvoices,
  salesInvoiceLines,
  salesOrderLineItems,
  customers,
  glAccounts,
  products as coreProducts,
  customerGroups,
  productGroups,
  tradingTerms,
  organizations,
  salesOrderReturns,
  salesOrderReturnLines,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { getExchangeRateForCurrency } from '../common/fx-helper';
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
  RETURN_STATE,
} from '@herobm/shared';
import { AppConfigService } from '../settings/app-config.service';
import { OrganizationService } from '../settings/organization.service';
import { EnrichmentService } from '../enrichment/enrichment.service';
import { CreateSalesInvoiceDto } from './dto';
import {
  SALES_INVOICE_STATE,
  SALES_ORDER_STATE,
  SalesOrderState,
  getErrorMessage,
} from '@herobm/shared';
import { getAvailableToInvoice } from '../orders/order-math.utils';
import { generateInvoiceNumber } from './sales-invoice-utils';
import { changeSalesInvoiceStateHelper } from './sales-invoice-state.helper';

@Injectable()
export class SalesInvoiceCreationService {
  private readonly logger = new Logger(SalesInvoiceCreationService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
    private readonly taxService: TaxCategoriesService,
    private readonly appConfig: AppConfigService,
    private readonly organizationService: OrganizationService,
    private readonly enrichmentService: EnrichmentService,
  ) {}

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
          name: organizations.name,
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
        .leftJoin(
          organizations,
          eq(customers.organizationId, organizations.organizationId),
        )
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
        productDescription: salesOrderLineItems.productDescription,
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

    const invoiceNumber = await generateInvoiceNumber(this.db);

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
      if (!invLine.salesOrderLineId) continue;
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
      if (!retLine.salesOrderLineId) continue;
      const current = refundedQtyByLine.get(retLine.salesOrderLineId) || 0;
      refundedQtyByLine.set(
        retLine.salesOrderLineId,
        current + parseFloat(retLine.quantityReturned),
      );
    }

    // 3. Compute the strictly typed AR payload bounds natively
    let rawTotal = 0;
    let rawTax = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle insert types
    const invoiceLineValues: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle insert types
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

      const availableToInvoice = getAvailableToInvoice(
        shippedQty,
        prevInvoicedQty,
        refundedQty,
      );

      if (qtyToInvoice > availableToInvoice + 0.0001) {
        throw new BadRequestException(
          `Line ${line.lineNumber} exceeds available invoice quantity. Requested: ${qtyToInvoice}, Available: ${availableToInvoice}`,
        );
      }

      totalInvoicingNow += qtyToInvoice;

      const price = parseFloat(line.pricePerUnit);
      const disc = parseFloat(line.discountPercentage || '0');

      let taxRate = 0;
      let lineSalesTaxAcctId: string | null = null;
      if (line.taxCategoryId) {
        try {
          const cat = await this.taxService.getById(line.taxCategoryId);
          taxRate = parseFloat(cat.rate || '0');
          lineSalesTaxAcctId = cat.salesGlAccountId || null;
        } catch (err: unknown) {
          const isNotFound =
            err instanceof NotFoundException ||
            (typeof err === 'object' &&
              err !== null &&
              'status' in err &&
              (err as { status: number }).status === 404);
          if (isNotFound) {
            taxRate = 0;
            lineSalesTaxAcctId = null;
          } else {
            throw err;
          }
        }
      }

      const pricing = computeLinePrice({
        quantity: qtyToInvoice,
        pricePerUnit: price,
        discountPercentage: disc,
        taxRate,
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
        productId: line.productId || null,
        description: line.productDescription || null,
        quantityInvoiced: String(qtyToInvoice),
        pricePerUnit: String(price),
        discountPercentage: String(disc),
        amount: String(pricing.amount),
        taxAmount: String(pricing.tax),
        taxCategoryId: line.taxCategoryId || null,
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
      const invoiceDate = dto.invoiceDate
        ? new Date(dto.invoiceDate)
        : new Date();
      let dueDate = new Date(invoiceDate);
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

      const invoicedInvoice = await changeSalesInvoiceStateHelper(
        this.db,
        this.glService,
        this.logger,
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

      // C. Generate specific Outbox Sync Event asynchronously routing back
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

      // D. Post GL journal entry (atomic with invoice creation)
      const settings = await this.glService.getSettings(tx);
      const effectiveArAccountId =
        customerArAccountId || settings?.defaultArAccountId;

      if (!effectiveArAccountId) {
        throw new BadRequestException(
          'Cannot create invoice: Accounts Receivable account (defaultArAccountId) is not configured in GL Settings. Please configure it in Admin → Settings → Financial.',
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

      const defaultRevenueCode = settings?.defaultRevenueAccountId
        ? idToCode.get(settings.defaultRevenueAccountId)
        : null;

      const taxCode = settings?.defaultSalesTaxAccountId
        ? idToCode.get(settings.defaultSalesTaxAccountId)
        : null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries
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

      for (const group of revenueGroups.values()) {
        let code = idToCode.get(group.customerId);
        if (!code && defaultRevenueCode) {
          code = defaultRevenueCode;
        }

        if (!code && group.amount > 0) {
          throw new BadRequestException(
            `Cannot create invoice: Revenue account '${group.customerId}' not found in Chart of Accounts.`,
          );
        }

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

      if (defaultRevenue > 0) {
        if (!defaultRevenueCode) {
          throw new BadRequestException(
            'Cannot create invoice: Default Revenue account (defaultRevenueAccountId) is not configured in GL Settings. Please configure it in Admin → Settings → Financial.',
          );
        }

        glLines.push({
          accountCode: defaultRevenueCode,
          debit: 0,
          credit: defaultRevenue * fx.rate,
          foreignCurrency: order.currencyCode,
          foreignDebit: 0,
          foreignCredit: defaultRevenue,
          memo: `Revenue: ${invoiceNumber}`,
          costCenterId: defaultRevenueCostCenterId || undefined,
          activityId: defaultRevenueActivityId || undefined,
        });
      }

      for (const [acctId, taxAmt] of taxGroups.entries()) {
        if (taxAmt > 0) {
          let effectiveTaxCode =
            acctId !== 'fallback' ? idToCode.get(acctId) : taxCode;
          if (!effectiveTaxCode && taxCode) {
            effectiveTaxCode = taxCode;
          }

          if (!effectiveTaxCode) {
            throw new BadRequestException(
              'Cannot create invoice: Sales Tax account (defaultSalesTaxAccountId) is not configured in GL Settings. Please configure it in Admin → Settings → Financial.',
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

      if (combinedTotal > 0) {
        if (glLines.length < 2) {
          throw new BadRequestException(
            'Cannot create invoice: Failed to construct balancing GL journal entry lines. Please verify that Default Accounts Receivable, Default Revenue, and Default Sales Tax accounts are configured in Admin → Settings → Financial.',
          );
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
      }

      // E. Record Transaction in External Engine if applicable
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries
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
}

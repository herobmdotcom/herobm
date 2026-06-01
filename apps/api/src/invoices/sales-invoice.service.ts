import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql, desc, and, gte, or } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesInvoices,
  salesInvoiceLines,
  salesOrderLineItems,
  outbox,
  orderEvents,
  customers,
  glAccounts,
  products as coreProducts,
  customerGroups,
  productGroups,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { getCommittedPerLine } from '../orders/shipment-helpers';
import { evaluateLifecycleRules } from '../orders/order-lifecycle-rules';
import { computeLinePrice } from '@modbm/shared';
import { AppConfigService } from '../settings/app-config.service';
import { OrganizationService } from '../settings/organization.service';
import { EnrichmentService } from '../enrichment/enrichment.service';
import { CreateSalesInvoiceDto } from './dto';
import {
  SALES_INVOICE_STATE,
  SALES_INVOICE_TRANSITIONS,
  SALES_ORDER_STATE,
  getValidStates,
} from '@modbm/shared';

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
   * Generates a structural sequence number for the AR invoice natively in ModBM.
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
      ![SALES_ORDER_STATE.SHIPPED, SALES_ORDER_STATE.PICKING].includes(
        order.stateCode as any,
      )
    ) {
      throw new BadRequestException(
        `Order ${order.orderNumber} must be in 'shipped' or 'picking' state to generate an invoice. Currently: '${order.stateCode}'.`,
      );
    }

    // Identify if the Customer has an external ID mapped natively already dynamically
    let externalId: string | null = null;
    let customerName = 'Unknown Customer';
    let customerArAccountId: string | null = null;
    let customerRevenueAccountId: string | null = null;
    let customerCostCenterId: string | null = null;
    let customerActivityId: string | null = null;
    let address1Country: string | null = null;
    let address1PostalCode: string | null = null;
    let address1StateOrProvince: string | null = null;
    let address1City: string | null = null;
    let address1Line1: string | null = null;

    if (order.customerId) {
      // Find Party details to bind
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          order.customerId,
        );

      const custRows = await this.db
        .select({
          externalId: customers.externalId,
          name: customers.name,
          defaultArAccountId: customerGroups.defaultArAccountId,
          defaultRevenueAccountId: customerGroups.defaultRevenueAccountId,
          defaultCostCenterId: customerGroups.defaultCostCenterId,
          defaultActivityId: customerGroups.defaultActivityId,
          address1Country: customers.address1Country,
          address1PostalCode: customers.address1PostalCode,
          address1StateOrProvince: customers.address1StateOrProvince,
          address1City: customers.address1City,
          address1Line1: customers.address1Line1,
        })
        .from(customers)
        .leftJoin(
          customerGroups,
          eq(customers.customerGroupId, customerGroups.customerGroupId),
        )
        .where(
          isUuid
            ? eq(customers.customerId, order.customerId)
            : eq(customers.externalId, order.customerId),
        )
        .limit(1);

      if (custRows.length > 0) {
        externalId = custRows[0].externalId;
        customerName = custRows[0].name;
        customerArAccountId = custRows[0].defaultArAccountId;
        customerRevenueAccountId = custRows[0].defaultRevenueAccountId;
        customerCostCenterId = custRows[0].defaultCostCenterId;
        customerActivityId = custRows[0].defaultActivityId;
        address1Country = custRows[0].address1Country;
        address1PostalCode = custRows[0].address1PostalCode;
        address1StateOrProvince = custRows[0].address1StateOrProvince;
        address1City = custRows[0].address1City;
        address1Line1 = custRows[0].address1Line1;
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

    // 3. Compute the strictly typed AR payload bounds natively
    let rawTotal = 0;
    let rawTax = 0;
    const invoiceLineValues: any[] = [];
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

      const isPhysical = !line.productType || line.productType === 'inventory';
      let shippedQty = shippedQtyMap.get(line.salesOrderLineId) || 0;

      if (!isPhysical) {
        const billingMode = this.appConfig.nonStockBillingMode();
        if (billingMode === 'final_invoice') {
          // Bill only on the final closing invoice
          if (order.stateCode === SALES_ORDER_STATE.SHIPPED) {
            shippedQty = orderedQty;
          } else {
            shippedQty = 0;
          }
        } else {
          // Bill fully on the very first shipment
          shippedQty = orderedQty;
        }
      }

      // Determine how much to invoice dynamically
      let qtyToInvoice = 0;
      if (dto.lines) {
        const reqLine = dto.lines.find(
          (l) => l.salesOrderLineId === line.salesOrderLineId,
        );
        qtyToInvoice = reqLine ? reqLine.quantityToInvoice : 0;
      } else {
        // Default fallback logic natively caps at strictly the shipped quantities
        qtyToInvoice = Math.max(0, shippedQty - prevInvoicedQty);
      }

      if (qtyToInvoice <= 0) {
        continue;
      }

      // We allow strict bounds locally natively
      // If there are rounding issues we may need to tune this, but mathematically
      // we check for precision mathematically:
      if (prevInvoicedQty + qtyToInvoice > shippedQty + 0.001) {
        throw new BadRequestException(
          `Cannot invoice more than shipped quantity for line ${line.lineNumber}. Requested: ${qtyToInvoice}, Remaining Shipped: ${Math.max(0, shippedQty - prevInvoicedQty)}`,
        );
      }

      totalInvoicingNow += qtyToInvoice;

      const price = parseFloat(line.pricePerUnit);
      const disc = parseFloat(line.discountPercentage ?? '0');

      // Resolve GST rate from the line's category (not the stored tax dollar amount)
      let taxRate = 0;
      if (line.taxCategoryId) {
        try {
          const cat = await this.taxService.getById(line.taxCategoryId);
          taxRate = parseFloat(cat.rate ?? '0');
        } catch {
          // Category not found — fall back to 0% tax
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

      // Group revenue by highest precedence GL customer
      const lineRevAcctId =
        this.appConfig.revenueRoutingPrecedence() === 'customer_first'
          ? customerRevenueAccountId || line.productRevenueAccountId || null
          : line.productRevenueAccountId || customerRevenueAccountId || null;

      // Resolve cost center / activity using same routing precedence
      const lineCostCenterId =
        this.appConfig.revenueRoutingPrecedence() === 'customer_first'
          ? customerCostCenterId || line.productCostCenterId || null
          : line.productCostCenterId || customerCostCenterId || null;
      const lineActivityId =
        this.appConfig.revenueRoutingPrecedence() === 'customer_first'
          ? customerActivityId || line.productActivityId || null
          : line.productActivityId || customerActivityId || null;
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
      // A. Create the Invoice header natively
      const [invoice] = await tx
        .insert(salesInvoices)
        .values({
          invoiceNumber,
          salesOrderId,
          totalAmount: String(combinedTotal), // AR takes the whole amount dynamically
          outstandingAmount: String(combinedTotal),
          taxAmount: String(taxAmount),
          currencyCode: order.currencyCode,
          stateCode: SALES_INVOICE_STATE.DRAFT, // Start in draft and then transition
          notes: dto.notes,
          createdBy: actor,
        })
        .returning();

      await this.changeSalesInvoiceState(
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
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: salesOrderId,
        eventType: EventType.SALES_INVOICED,
        payload: outboxPayload,
        actor,
      });

      // E. Post GL journal entry (atomic with invoice creation)
      const settings = await this.glService.getSettings(tx);
      const effectiveArAccountId =
        customerArAccountId || settings?.defaultArAccountId;

      if (effectiveArAccountId) {
        // Collect all distinct Customer IDs logically needed
        const distinctAccountIds = new Set<string>();
        distinctAccountIds.add(effectiveArAccountId);
        if (settings?.defaultTaxAccountId)
          distinctAccountIds.add(settings.defaultTaxAccountId);
        if (settings?.defaultRevenueAccountId)
          distinctAccountIds.add(settings.defaultRevenueAccountId);
        for (const group of revenueGroups.values()) {
          distinctAccountIds.add(group.customerId);
        }

        const settingsIds = Array.from(distinctAccountIds).filter(Boolean);

        if (settingsIds.length > 0) {
          const glAcct = glAccounts;
          const acctRows = await tx
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
            );

          const idToCode = new Map(
            acctRows.map((a) => [a.glAccountId, a.accountCode]),
          );

          const arCode = idToCode.get(effectiveArAccountId);
          const taxCode = settings?.defaultTaxAccountId
            ? idToCode.get(settings.defaultTaxAccountId)
            : null;

          if (arCode) {
            const glLines: any[] = [
              {
                accountCode: arCode,
                debit: combinedTotal,
                credit: 0,
                memo: `AR: ${invoiceNumber}`,
                partyType: 'customer',
                partyId: order.customerId,
                costCenterId: customerCostCenterId || undefined,
                activityId: customerActivityId || undefined,
              },
            ];

            // 1. Map explicitly dynamic revenue lines (grouped by customer + dimensions)
            for (const group of revenueGroups.values()) {
              const code = idToCode.get(group.customerId);
              if (code && group.amount > 0) {
                glLines.push({
                  accountCode: code,
                  debit: 0,
                  credit: group.amount,
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

              if (defCode) {
                glLines.push({
                  accountCode: defCode,
                  debit: 0,
                  credit: defaultRevenue,
                  memo: `Revenue: ${invoiceNumber} (Default)`,
                  costCenterId: defaultRevenueCostCenterId || undefined,
                  activityId: defaultRevenueActivityId || undefined,
                });
              } else {
                this.logger.warn(
                  `Missing global default revenue customer to cover ${defaultRevenue} on invoice ${invoiceNumber}`,
                );
              }
            }

            if (taxCode && taxAmount > 0) {
              glLines.push({
                accountCode: taxCode,
                debit: 0,
                credit: taxAmount,
                memo: `GST: ${invoiceNumber}`,
              });
            }

            await this.glService.postJournalEntry(
              glLines,
              {
                sourceType: 'sales_invoice',
                sourceId: invoice.invoiceId,
                memo: `Sales invoice ${invoiceNumber} for order ${order.orderNumber}`,
                actor,
              },
              tx,
            );

            this.logger.log(
              `GL journal posted for sales invoice ${invoiceNumber}`,
            );
          }
        }
      }

      // F. Record Transaction in External Engine if applicable
      const orderTaxProvider = (order as any).taxProvider;
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
          to_country: address1Country || 'US',
          to_zip: address1PostalCode,
          to_state: address1StateOrProvince,
          to_city: address1City,
          to_street: address1Line1,
          line_items: taxableLines.map((l) => {
            const payloadLine: any = {
              id: l.salesOrderLineId,
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
              `Tax provider rejected transaction: ${enrichRes.data?.error}`,
            );
          }
          this.logger.log(
            `Transaction recorded in ${orderTaxProvider} for invoice ${invoiceNumber}`,
          );
        } catch (e: any) {
          this.logger.error(
            `Failed to record transaction in ${orderTaxProvider}`,
            e,
          );
          throw new BadRequestException(
            `Failed to record transaction in ${orderTaxProvider}: ${e.message}`,
          );
        }
      }

      return invoice;
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
   * Fetch a specific ModBM Sales Invoice with natively populated mappings structurally
   */
  async findOne(invoiceId: string) {
    const rows = await this.db
      .select({
        invoiceId: salesInvoices.invoiceId,
        invoiceNumber: salesInvoices.invoiceNumber,
        salesOrderId: salesInvoices.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        customerId: salesOrders.customerId,
        customerName: customers.name,
        totalAmount: salesInvoices.totalAmount,
        taxAmount: salesInvoices.taxAmount,
        outstandingAmount: salesInvoices.outstandingAmount,
        currencyCode: salesInvoices.currencyCode,
        stateCode: salesInvoices.stateCode,
        createdOn: salesInvoices.createdOn,
        notes: salesOrders.notes, // Or if salesInvoices has its own notes
      })
      .from(salesInvoices)
      .innerJoin(
        salesOrders,
        eq(salesInvoices.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(customers, eq(salesOrders.customerId, customers.customerId))
      .where(eq(salesInvoices.invoiceId, invoiceId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Invoice '${invoiceId}' not found directly.`);
    }

    const invoice = rows[0];

    // Hydrate explicitly native ModBM line mapping structurally
    const lines = await this.db
      .select({
        lineId: salesInvoiceLines.invoiceLineId,
        quantityInvoiced: salesInvoiceLines.quantityInvoiced,
        pricePerUnit: salesInvoiceLines.pricePerUnit,
        amount: salesInvoiceLines.amount,
        productId: salesOrderLineItems.productId,
        productNumber: coreProducts.productNumber,
        description: coreProducts.name, // Use product name as default description
      })
      .from(salesInvoiceLines)
      .innerJoin(
        salesOrderLineItems,
        eq(
          salesInvoiceLines.salesOrderLineId,
          salesOrderLineItems.salesOrderLineId,
        ),
      )
      .innerJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .where(eq(salesInvoiceLines.invoiceId, invoiceId));

    return { ...invoice, lines };
  }

  /**
   * Fetch all Native ModBM Invoices strictly tied to a distinct active order
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

      const groupedLines = new Map<string, any[]>();
      for (const line of allLines) {
        if (!groupedLines.has(line.invoiceId)) {
          groupedLines.set(line.invoiceId, []);
        }
        groupedLines.get(line.invoiceId)!.push(line);
      }

      return invoices.map((inv) => ({
        ...inv,
        lines: groupedLines.get(inv.invoiceId) || [],
      }));
    }

    return invoices;
  }

  /**
   * Fetch a flattened, global list of Sales Invoices spanning multiple orders.
   * Useful for the "All Invoices" page and Customer Detail tabs.
   */
  async findActiveInvoices(query: {
    days?: number;
    customerId?: string;
    invoiceId?: string;
    balanceStatus?: string;
    limit?: number;
  }) {
    const {
      days = 30,
      customerId,
      invoiceId,
      balanceStatus,
      limit = 100,
    } = query;

    const conditions: any[] = [];

    // When filtering by specific invoiceId, skip the date range filter
    if (invoiceId) {
      conditions.push(eq(salesInvoices.invoiceId, invoiceId));
    } else if (days > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      conditions.push(gte(salesInvoices.createdOn, cutoffDate));
    }

    if (customerId) {
      conditions.push(
        or(
          eq(salesOrders.customerId, customerId),
          eq(customers.externalId, customerId),
        ),
      );
    }

    if (balanceStatus === 'unpaid') {
      conditions.push(sql`${salesInvoices.outstandingAmount}::numeric > 0`);
    } else if (balanceStatus === 'paid') {
      conditions.push(sql`${salesInvoices.outstandingAmount}::numeric <= 0`);
    }

    const dataQuery = this.db
      .select({
        invoiceId: salesInvoices.invoiceId,
        invoiceNumber: salesInvoices.invoiceNumber,
        salesOrderId: salesInvoices.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        customerId: salesOrders.customerId,
        customerName: customers.name,
        totalAmount: salesInvoices.totalAmount,
        taxAmount: salesInvoices.taxAmount,
        outstandingAmount: salesInvoices.outstandingAmount,
        currencyCode: salesInvoices.currencyCode,
        stateCode: salesInvoices.stateCode,
        createdOn: salesInvoices.createdOn,
      })
      .from(salesInvoices)
      .innerJoin(
        salesOrders,
        eq(salesInvoices.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(customers, eq(salesOrders.customerId, customers.customerId))
      .where(and(...conditions))
      .orderBy(desc(salesInvoices.createdOn));

    if (limit > 0) {
      return await dataQuery.limit(limit);
    }
    return await dataQuery;
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

    const db = tx || this.db;
    const [existing] = await db
      .select({
        stateCode: salesInvoices.stateCode,
        invoiceNumber: salesInvoices.invoiceNumber,
      })
      .from(salesInvoices)
      .where(eq(salesInvoices.invoiceId, invoiceId))
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

    const [updated] = await db
      .update(salesInvoices)
      .set({
        stateCode: newState as any,
        modifiedOn: new Date(),
      })
      .where(eq(salesInvoices.invoiceId, invoiceId))
      .returning();

    await emitEvent(db as any, {
      aggregateType: AggregateType.SALES_INVOICE,
      aggregateId: invoiceId,
      eventType: EventType.STATUS_CHANGED,
      payload: {
        entity: 'sales_invoice',
        entityId: invoiceId,
        invoiceNumber: existing.invoiceNumber,
        from: existing.stateCode,
        to: newState,
      },
      actor,
    });

    return updated;
  }
}

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
  accounts,
  glAccounts,
  products as coreProducts,
  accountGroups,
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
import { CreateSalesInvoiceDto } from './dto';

@Injectable()
export class SalesInvoiceService {
  private readonly logger = new Logger(SalesInvoiceService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
    private readonly taxService: TaxCategoriesService,
    private readonly appConfig: AppConfigService,
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
    if (!['shipped', 'picking'].includes(order.stateCode)) {
      throw new BadRequestException(
        `Order ${order.orderNumber} must be in 'shipped' or 'picking' state to generate an invoice. Currently: '${order.stateCode}'.`,
      );
    }

    // Identify if the Customer has an external ID mapped natively already dynamically
    let externalId: string | null = null;
    let customerName = 'Unknown Customer';
    let customerArAccountId: string | null = null;
    let customerRevenueAccountId: string | null = null;

    if (order.customerId) {
      // Find Party details to bind
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          order.customerId,
        );

      const custRows = await this.db
        .select({
          externalId: accounts.externalId,
          name: accounts.name,
          defaultArAccountId: accountGroups.defaultArAccountId,
          defaultRevenueAccountId: accountGroups.defaultRevenueAccountId,
        })
        .from(accounts)
        .leftJoin(
          accountGroups,
          eq(accounts.accountGroupId, accountGroups.accountGroupId),
        )
        .where(
          isUuid
            ? eq(accounts.accountId, order.customerId)
            : eq(accounts.externalId, order.customerId),
        )
        .limit(1);

      if (custRows.length > 0) {
        externalId = custRows[0].externalId;
        customerName = custRows[0].name;
        customerArAccountId = custRows[0].defaultArAccountId;
        customerRevenueAccountId = custRows[0].defaultRevenueAccountId;
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

    // Revenue GL Routing tallies
    const revenueByAccountId = new Map<string, number>();
    let defaultRevenue = 0;

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
          if (order.stateCode === 'shipped') {
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

      // Group revenue by highest precedence GL account
      const lineRevAcctId =
        this.appConfig.revenueRoutingPrecedence() === 'customer_first'
          ? customerRevenueAccountId || line.productRevenueAccountId || null
          : line.productRevenueAccountId || customerRevenueAccountId || null;
      if (lineRevAcctId) {
        revenueByAccountId.set(
          lineRevAcctId,
          (revenueByAccountId.get(lineRevAcctId) || 0) + pricing.amount,
        );
      } else {
        defaultRevenue += pricing.amount;
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

    // 4. Begin transactional generation
    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      // A. Create the Invoice header natively
      const [invoice] = await tx
        .insert(salesInvoices)
        .values({
          invoiceNumber,
          salesOrderId,
          totalAmount: String(combinedTotal), // AR takes the whole amount dynamically
          taxAmount: String(taxAmount),
          currencyCode: order.currencyCode,
          stateCode: 'invoiced',
          notes: dto.notes,
          createdBy: actor,
        })
        .returning();

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

    // 5. Post GL journal entry (outside the transaction — GL service has its own tx)
    try {
      const settings = await this.glService.getSettings();
      const effectiveArAccountId =
        customerArAccountId || settings?.defaultArAccountId;

      if (effectiveArAccountId) {
        // Collect all distinct Account IDs logically needed
        const distinctAccountIds = new Set<string>();
        distinctAccountIds.add(effectiveArAccountId);
        if (settings?.defaultTaxAccountId)
          distinctAccountIds.add(settings.defaultTaxAccountId);
        if (settings?.defaultRevenueAccountId)
          distinctAccountIds.add(settings.defaultRevenueAccountId);
        for (const acctId of revenueByAccountId.keys()) {
          distinctAccountIds.add(acctId);
        }

        const settingsIds = Array.from(distinctAccountIds).filter(Boolean);

        if (settingsIds.length > 0) {
          const glAcct = glAccounts;
          const acctRows = await this.db
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
              },
            ];

            // 1. Map explicitly dynamic revenue lines
            for (const [acctId, revAmt] of revenueByAccountId.entries()) {
              const code = idToCode.get(acctId);
              if (code && revAmt > 0) {
                glLines.push({
                  accountCode: code,
                  debit: 0,
                  credit: revAmt,
                  memo: `Revenue: ${invoiceNumber}`,
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
                });
              } else {
                this.logger.warn(
                  `Missing global default revenue account to cover ${defaultRevenue} on invoice ${invoiceNumber}`,
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

            await this.glService.postJournalEntry(glLines, {
              sourceType: 'sales_invoice',
              sourceId: result.invoiceId,
              memo: `Sales invoice ${invoiceNumber} for order ${order.orderNumber}`,
              actor,
            });

            this.logger.log(
              `GL journal posted for sales invoice ${invoiceNumber}`,
            );
          }
        }
      }
    } catch (glErr) {
      // GL posting is non-fatal — log and continue (outbox handles external sync)
      this.logger.warn(
        `GL posting failed for invoice ${invoiceNumber}: ${(glErr as Error).message}`,
      );
    }

    return result;
  }

  /**
   * Fetch a specific ModBM Sales Invoice with natively populated mappings structurally
   */
  async findOne(invoiceId: string) {
    const rows = await this.db
      .select()
      .from(salesInvoices)
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
      })
      .from(salesInvoiceLines)
      .innerJoin(
        salesOrderLineItems,
        eq(
          salesInvoiceLines.salesOrderLineId,
          salesOrderLineItems.salesOrderLineId,
        ),
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
   * Useful for the "All Invoices" page and Account Detail tabs.
   */
  async findActiveInvoices(query: {
    days?: number;
    accountId?: string;
    invoiceId?: string;
    limit?: number;
  }) {
    const { days = 30, accountId, invoiceId, limit = 100 } = query;

    const conditions: any[] = [];

    // When filtering by specific invoiceId, skip the date range filter
    if (invoiceId) {
      conditions.push(eq(salesInvoices.invoiceId, invoiceId));
    } else if (days > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      conditions.push(gte(salesInvoices.createdOn, cutoffDate));
    }

    if (accountId) {
      conditions.push(
        or(
          eq(salesOrders.customerId, accountId),
          eq(accounts.externalId, accountId),
        ),
      );
    }

    const dataQuery = this.db
      .select({
        invoiceId: salesInvoices.invoiceId,
        invoiceNumber: salesInvoices.invoiceNumber,
        salesOrderId: salesInvoices.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        customerId: salesOrders.customerId,
        customerName: accounts.name,
        totalAmount: salesInvoices.totalAmount,
        taxAmount: salesInvoices.taxAmount,
        currencyCode: salesInvoices.currencyCode,
        stateCode: salesInvoices.stateCode,
        createdOn: salesInvoices.createdOn,
      })
      .from(salesInvoices)
      .innerJoin(
        salesOrders,
        eq(salesInvoices.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(accounts, eq(salesOrders.customerId, accounts.accountId))
      .where(and(...conditions))
      .orderBy(desc(salesInvoices.createdOn));

    if (limit > 0) {
      return await dataQuery.limit(limit);
    }
    return await dataQuery;
  }
}

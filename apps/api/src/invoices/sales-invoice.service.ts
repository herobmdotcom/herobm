import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql, desc } from 'drizzle-orm';
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
} from '../drizzle/modbm-core-schema';
import { GlService } from '../gl/gl.service';

export interface CreateSalesInvoiceDto {
  notes?: string;
}

@Injectable()
export class SalesInvoiceService {
  private readonly logger = new Logger(SalesInvoiceService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
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
   * Leverages transactional Outbox pattern to orchestrate async ERPNext GL mapping.
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
    if (order.stateCode !== 'dispatched') {
      throw new BadRequestException(
        `Order ${order.orderNumber} must be in 'dispatched' state to generate an invoice. Currently: '${order.stateCode}'.`,
      );
    }

    // Identify if the Customer has an ERPNext ID mapped natively already dynamically
    let erpnextId: string | null = null;
    let customerName = 'Unknown Customer';
    if (order.customerId) {
        // Find Party details to bind
        const custRows = await this.db
          .select({ erpnextId: accounts.erpnextId, name: accounts.name })
          .from(accounts)
          .where(eq(accounts.accountId, order.customerId))
          .limit(1);
        
        if (custRows.length > 0) {
            erpnextId = custRows[0].erpnextId;
            customerName = custRows[0].name;
        }
    }

    // 2. Load the structural Sales Order Line dimensions to invoice explicitly
    const orderLines = await this.db
      .select()
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, salesOrderId));

    if (orderLines.length === 0) {
      throw new BadRequestException('Cannot invoice an empty order.');
    }

    const invoiceNumber = await this.generateInvoiceNumber();

    // 3. Compute the strictly typed AR payload bounds natively
    let rawTotal = 0;
    let rawTax = 0;
    const invoiceLineValues: any[] = [];
    const outboxLineDetails: any[] = [];

    for (const line of orderLines) {
      // ModBM Phase 2 simplification natively invoices exactly the committed qty
      const qty = parseFloat(line.quantity);
      const price = parseFloat(line.pricePerUnit);
      const taxParam = parseFloat(line.tax ?? '0');
      const amount = qty * price;
      const computedTax = (amount * taxParam) / 100;

      rawTotal += amount;
      rawTax += computedTax;

      invoiceLineValues.push({
        salesOrderLineId: line.salesOrderLineId,
        quantityInvoiced: String(qty),
        pricePerUnit: String(price),
        amount: String(amount),
      });

      outboxLineDetails.push({
        salesOrderLineId: line.salesOrderLineId,
        productId: line.productId,
        quantity: qty,
        amount: amount,
        tax: computedTax,
      });
    }

    const totalAmount = rawTotal;
    const taxAmount = rawTax;
    const combinedTotal = totalAmount + taxAmount;

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
      await tx
        .update(salesOrders)
        .set({ stateCode: 'invoiced', modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, salesOrderId));

      await tx.insert(orderEvents).values({
        salesOrderId,
        eventType: 'sales_invoiced',
        payload: { invoiceId: invoice.invoiceId, invoiceNumber },
        actor,
      });

      // D. Generate specific Outbox Sync Event asynchronously routing back
      const outboxPayload = {
        invoiceId: invoice.invoiceId,
        invoiceNumber,
        salesOrderId,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName: customerName,
        erpnextId: erpnextId,
        totalRevenue: totalAmount,
        totalTax: taxAmount,
        totalAccountsReceivable: combinedTotal,
        currency: order.currencyCode,
        lines: outboxLineDetails,
      };

      await tx.insert(outbox).values({
        aggregateType: 'sales_invoice',
        aggregateId: invoice.invoiceId,
        eventType: 'sales_invoiced',
        payload: outboxPayload,
      });

      return invoice;
    });

    this.logger.log(
      `Native Sales Invoice created: ${invoiceNumber} for order ${order.orderNumber} strictly mapping AR boundary`,
    );

    // 5. Post GL journal entry (outside the transaction — GL service has its own tx)
    try {
      const settings = await this.glService.getSettings();
      if (settings?.defaultArAccountId) {
        // Resolve account codes from settings
        const settingsIds = [
          settings.defaultArAccountId,
          settings.defaultRevenueAccountId,
          settings.defaultTaxAccountId,
        ].filter(Boolean);

        const glAcct = glAccounts;
        const acctRows = await this.db
          .select({ glAccountId: glAcct.glAccountId, accountCode: glAcct.accountCode })
          .from(glAcct)
          .where(sql`${glAcct.glAccountId} IN (${sql.join(settingsIds.map(id => sql`${id}`), sql`, `)})`);

        const idToCode = new Map(acctRows.map(a => [a.glAccountId, a.accountCode]));
        const arCode = idToCode.get(settings.defaultArAccountId!);
        const revCode = settings.defaultRevenueAccountId ? idToCode.get(settings.defaultRevenueAccountId) : null;
        const taxCode = settings.defaultTaxAccountId ? idToCode.get(settings.defaultTaxAccountId) : null;

        if (arCode && revCode) {
          const glLines: any[] = [
            { accountCode: arCode, debit: combinedTotal, credit: 0, memo: `AR: ${invoiceNumber}` },
            { accountCode: revCode, debit: 0, credit: totalAmount, memo: `Revenue: ${invoiceNumber}` },
          ];
          if (taxCode && taxAmount > 0) {
            glLines.push({ accountCode: taxCode, debit: 0, credit: taxAmount, memo: `GST: ${invoiceNumber}` });
          }

          await this.glService.postJournalEntry(glLines, {
            sourceType: 'sales_invoice',
            sourceId: result.invoiceId,
            memo: `Sales invoice ${invoiceNumber} for order ${order.orderNumber}`,
            actor,
          });

          this.logger.log(`GL journal posted for sales invoice ${invoiceNumber}`);
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

    return invoices;
  }
}

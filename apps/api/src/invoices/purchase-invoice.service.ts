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
  purchaseOrders,
  purchaseInvoices,
  purchaseInvoiceLines,
  purchaseOrderLineItems,
  outbox,
  purchaseOrderEvents,
  suppliers,
  glAccounts,
} from '../drizzle/modbm-core-schema';
import { GlService } from '../gl/gl.service';

export interface CreatePurchaseBillDto {
  supplierInvoiceNumber?: string;
  notes?: string;
}

@Injectable()
export class PurchaseInvoiceService {
  private readonly logger = new Logger(PurchaseInvoiceService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
  ) {}

  /**
   * Generates a structural sequence number for the internal AP bill record natively in ModBM.
   */
  private async generateBillNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `BILL-${today}-`;

    const result = await this.db
      .select({ invoiceNumber: purchaseInvoices.invoiceNumber })
      .from(purchaseInvoices)
      .where(sql`${purchaseInvoices.invoiceNumber} LIKE ${prefix + '%'}`)
      .orderBy(sql`${purchaseInvoices.invoiceNumber} DESC`)
      .limit(1);

    const seq =
      result.length > 0
        ? parseInt(result[0].invoiceNumber.replace(prefix, ''), 10) + 1
        : 1;

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /**
   * Transition a definitively received Purchase Order directly into the natively Invoiced status.
   * Leverages transactional Outbox pattern to orchestrate async ERPNext AP GL mapping.
   */
  async createBill(
    purchaseOrderId: string,
    dto: CreatePurchaseBillDto,
    actor: string,
  ) {
    // 1. Validate Order State strictly (must be completely received logically)
    const orderRows = await this.db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, purchaseOrderId))
      .limit(1);

    if (orderRows.length === 0) {
      throw new NotFoundException(
        `Purchase Order '${purchaseOrderId}' not found`,
      );
    }

    const order = orderRows[0];
    if (order.stateCode !== 'received') {
      throw new BadRequestException(
        `Order ${order.orderNumber} must be in 'received' state to generate a supplier bill. Currently: '${order.stateCode}'.`,
      );
    }

    // Identify if the Supplier has an ERPNext ID mapped natively already dynamically
    let erpnextId: string | null = null;
    let supplierName = 'Unknown Supplier';
    if (order.vendorId) {
      // Find Party details to bind natively
      const suppRows = await this.db
        .select({ erpnextId: suppliers.erpnextId, name: suppliers.name })
        .from(suppliers)
        .where(eq(suppliers.vendorId, order.vendorId))
        .limit(1);

      if (suppRows.length > 0) {
        erpnextId = suppRows[0].erpnextId;
        supplierName = suppRows[0].name;
      }
    }

    // 2. Load the structural PO Line dimensions to bill explicitly
    const orderLines = await this.db
      .select()
      .from(purchaseOrderLineItems)
      .where(eq(purchaseOrderLineItems.purchaseOrderId, purchaseOrderId));

    if (orderLines.length === 0) {
      throw new BadRequestException(
        'Cannot enter a bill for an empty purchase order.',
      );
    }

    const internalBillNumber = await this.generateBillNumber();

    // 3. Compute the strictly typed AP payload bounds natively
    let rawTotal = 0;
    let rawTax = 0;
    const invoiceLineValues: any[] = [];
    const outboxLineDetails: any[] = [];

    for (const line of orderLines) {
      // ModBM natively bills the expected received quantity (committed lines)
      const qty = parseFloat(line.quantity);
      const price = parseFloat(line.pricePerUnit);
      const taxParam = parseFloat(line.tax ?? '0');
      const amount = qty * price;
      const computedTax = (amount * taxParam) / 100;

      rawTotal += amount;
      rawTax += computedTax;

      invoiceLineValues.push({
        purchaseOrderLineId: line.purchaseOrderLineId,
        quantityInvoiced: String(qty),
        pricePerUnit: String(price),
        amount: String(amount),
      });

      outboxLineDetails.push({
        purchaseOrderLineId: line.purchaseOrderLineId,
        productId: line.productId,
        quantity: qty,
        amount: amount,
        tax: computedTax,
      });
    }

    const totalAmount = rawTotal;
    const taxAmount = rawTax;
    const combinedTotal = totalAmount + taxAmount;

    // 4. Begin transactional generation natively
    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      // A. Create the AP Bill header natively
      const [invoice] = await tx
        .insert(purchaseInvoices)
        .values({
          invoiceNumber: internalBillNumber,
          purchaseOrderId,
          supplierInvoiceNumber: dto.supplierInvoiceNumber,
          totalAmount: String(combinedTotal), // AP assumes gross load structurally
          taxAmount: String(taxAmount),
          currencyCode: order.currencyCode,
          stateCode: 'invoiced',
          notes: dto.notes,
          createdBy: actor,
        })
        .returning();

      // B. Structure local Bill Details mapping natively
      const preparedLines = invoiceLineValues.map((l) => ({
        ...l,
        invoiceId: invoice.invoiceId,
      }));
      await tx.insert(purchaseInvoiceLines).values(preparedLines);

      // C. Transition originating Order cleanly natively
      await tx
        .update(purchaseOrders)
        .set({ stateCode: 'invoiced', modifiedOn: new Date() })
        .where(eq(purchaseOrders.purchaseOrderId, purchaseOrderId));

      await tx.insert(purchaseOrderEvents).values({
        purchaseOrderId,
        eventType: 'purchase_invoiced',
        payload: {
          invoiceId: invoice.invoiceId,
          internalBillNumber,
          supplierInvoiceNumber: dto.supplierInvoiceNumber,
        },
        actor,
      });

      // D. Generate specific AP Outbox Sync Event asynchronously routing back
      const outboxPayload = {
        invoiceId: invoice.invoiceId,
        invoiceNumber: internalBillNumber,
        supplierInvoiceNumber: dto.supplierInvoiceNumber,
        purchaseOrderId,
        orderNumber: order.orderNumber,
        supplierId: order.vendorId,
        supplierName: supplierName,
        erpnextId: erpnextId,
        totalExpense: totalAmount,
        totalTax: taxAmount,
        totalAccountsPayable: combinedTotal,
        currency: order.currencyCode,
        lines: outboxLineDetails,
      };

      await tx.insert(outbox).values({
        aggregateType: 'purchase_invoice',
        aggregateId: invoice.invoiceId,
        eventType: 'purchase_invoiced',
        payload: outboxPayload,
      });

      return invoice;
    });

    this.logger.log(
      `Native Purchase Bill created: ${internalBillNumber} for PO ${order.orderNumber} securely bounding AP sync`,
    );

    // 5. Post GL journal entry (outside the transaction — GL service has its own tx)
    try {
      const settings = await this.glService.getSettings();
      if (settings?.defaultApAccountId && settings?.defaultExpenseAccountId) {
        const settingsIds = [
          settings.defaultApAccountId,
          settings.defaultExpenseAccountId,
          settings.defaultTaxAccountId,
        ].filter(Boolean);

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
        const apCode = idToCode.get(settings.defaultApAccountId);
        const expCode = idToCode.get(settings.defaultExpenseAccountId);
        const taxCode = settings.defaultTaxAccountId
          ? idToCode.get(settings.defaultTaxAccountId)
          : null;

        if (apCode && expCode) {
          const glLines: any[] = [
            {
              accountCode: expCode,
              debit: totalAmount,
              credit: 0,
              memo: `Expense: ${internalBillNumber}`,
            },
          ];
          if (taxCode && taxAmount > 0) {
            // GST Paid is an asset (input tax credit)
            glLines.push({
              accountCode: taxCode,
              debit: taxAmount,
              credit: 0,
              memo: `GST Paid: ${internalBillNumber}`,
            });
          }
          glLines.push({
            accountCode: apCode,
            debit: 0,
            credit: combinedTotal,
            memo: `AP: ${internalBillNumber}`,
            partyType: 'supplier',
            partyId: order.vendorId,
          });

          await this.glService.postJournalEntry(glLines, {
            sourceType: 'purchase_invoice',
            sourceId: result.invoiceId,
            memo: `Purchase bill ${internalBillNumber} for PO ${order.orderNumber}`,
            actor,
          });

          this.logger.log(
            `GL journal posted for purchase bill ${internalBillNumber}`,
          );
        }
      }
    } catch (glErr) {
      console.error('GL Error generating AP bill posting:', glErr);
      this.logger.warn(
        `GL posting failed for bill ${internalBillNumber}: ${(glErr as Error).message}`,
      );
    }

    return result;
  }

  /**
   * Fetch a specific ModBM AP Bill with natively populated mappings structurally
   */
  async findOne(invoiceId: string) {
    const rows = await this.db
      .select()
      .from(purchaseInvoices)
      .where(eq(purchaseInvoices.invoiceId, invoiceId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Bill '${invoiceId}' not found directly.`);
    }

    const invoice = rows[0];

    // Hydrate explicitly native ModBM line mapping structurally
    const lines = await this.db
      .select({
        lineId: purchaseInvoiceLines.invoiceLineId,
        quantityInvoiced: purchaseInvoiceLines.quantityInvoiced,
        pricePerUnit: purchaseInvoiceLines.pricePerUnit,
        amount: purchaseInvoiceLines.amount,
        productId: purchaseOrderLineItems.productId,
      })
      .from(purchaseInvoiceLines)
      .innerJoin(
        purchaseOrderLineItems,
        eq(
          purchaseInvoiceLines.purchaseOrderLineId,
          purchaseOrderLineItems.purchaseOrderLineId,
        ),
      )
      .where(eq(purchaseInvoiceLines.invoiceId, invoiceId));

    return { ...invoice, lines };
  }

  /**
   * Fetch all Native ModBM Bills strictly tied to a distinct active purchase order
   */
  async findByOrder(purchaseOrderId: string) {
    const invoices = await this.db
      .select()
      .from(purchaseInvoices)
      .where(eq(purchaseInvoices.purchaseOrderId, purchaseOrderId))
      .orderBy(desc(purchaseInvoices.createdOn));

    return invoices;
  }
}

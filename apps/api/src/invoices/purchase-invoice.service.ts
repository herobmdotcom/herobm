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
  supplierGroups,
  products as coreProducts,
  productGroups,
  glAccounts,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import { GlService } from '../gl/gl.service';
import { GstCategoriesService } from '../gst/gst-categories.service';
import { computeLinePrice, EXPENSE_ROUTING_PRECEDENCE } from '@modbm/shared';
import { CreatePurchaseBillDto } from './dto';

@Injectable()
export class PurchaseInvoiceService {
  private readonly logger = new Logger(PurchaseInvoiceService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
    private readonly gstService: GstCategoriesService,
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
    if (!['received', 'partially_received'].includes(order.stateCode)) {
      throw new BadRequestException(
        `Order ${order.orderNumber} must be in 'received' or 'partially_received' state to generate a supplier bill. Currently: '${order.stateCode}'.`,
      );
    }

    // Identify if the Supplier has an ERPNext ID mapped natively already dynamically
    let erpnextId: string | null = null;
    let supplierName = 'Unknown Supplier';
    let supplierApAccountId: string | null = null;
    let supplierExpenseAccountId: string | null = null;
    if (order.vendorId) {
      // Find Party details to bind natively
      const suppRows = await this.db
        .select({
          erpnextId: suppliers.erpnextId,
          name: suppliers.name,
          defaultApAccountId: supplierGroups.defaultApAccountId,
          defaultExpenseAccountId: supplierGroups.defaultExpenseAccountId,
        })
        .from(suppliers)
        .leftJoin(
          supplierGroups,
          eq(suppliers.supplierGroupId, supplierGroups.supplierGroupId),
        )
        .where(eq(suppliers.vendorId, order.vendorId))
        .limit(1);

      if (suppRows.length > 0) {
        erpnextId = suppRows[0].erpnextId;
        supplierName = suppRows[0].name;
        supplierApAccountId = suppRows[0].defaultApAccountId;
        supplierExpenseAccountId = suppRows[0].defaultExpenseAccountId;
      }
    }

    // 2. Load the structural PO Line dimensions to bill explicitly
    const orderLinesQuery = await this.db
      .select({
        line: purchaseOrderLineItems,
        productExpenseAccountId: productGroups.defaultExpenseAccountId,
      })
      .from(purchaseOrderLineItems)
      .leftJoin(
        coreProducts,
        eq(purchaseOrderLineItems.productId, coreProducts.productId),
      )
      .leftJoin(
        productGroups,
        eq(coreProducts.productGroupId, productGroups.productGroupId),
      )
      .where(eq(purchaseOrderLineItems.purchaseOrderId, purchaseOrderId));

    const orderLines = orderLinesQuery.map((row) => ({
      ...row.line,
      productExpenseAccountId: row.productExpenseAccountId,
    }));

    if (orderLines.length === 0) {
      throw new BadRequestException(
        'Cannot enter a bill for an empty purchase order.',
      );
    }

    const internalBillNumber = await this.generateBillNumber();

    // Fetch previously invoiced lines for this order natively
    const priorInvoices = await this.db
      .select({
        purchaseOrderLineId: purchaseInvoiceLines.purchaseOrderLineId,
        quantityInvoiced: purchaseInvoiceLines.quantityInvoiced,
      })
      .from(purchaseInvoiceLines)
      .innerJoin(
        purchaseInvoices,
        eq(purchaseInvoiceLines.invoiceId, purchaseInvoices.invoiceId),
      )
      .where(eq(purchaseInvoices.purchaseOrderId, purchaseOrderId));

    const invoicedQtyByLine = new Map<string, number>();
    for (const invLine of priorInvoices) {
      const current = invoicedQtyByLine.get(invLine.purchaseOrderLineId) || 0;
      invoicedQtyByLine.set(
        invLine.purchaseOrderLineId,
        current + parseFloat(invLine.quantityInvoiced),
      );
    }
    // 3. Compute the strictly typed AP payload bounds natively
    let rawTotal = 0;
    let rawTax = 0;
    const invoiceLineValues: any[] = [];
    const outboxLineDetails: any[] = [];

    // Expense GL Routing tallies
    const expenseByAccountId = new Map<string, number>();
    let defaultExpense = 0;

    let totalOrderedQty = 0;
    let totalInvoicedSoFar = 0;
    let totalInvoicingNow = 0;

    for (const line of orderLines) {
      const orderedQty = parseFloat(line.quantity);
      totalOrderedQty += orderedQty;

      const prevInvoicedQty =
        invoicedQtyByLine.get(line.purchaseOrderLineId) || 0;
      totalInvoicedSoFar += prevInvoicedQty;

      const receivedQty = parseFloat((line as any).quantityReceived || '0');

      let qtyToInvoice = 0;
      if (dto.lines) {
        const reqLine = dto.lines.find(
          (l) => l.purchaseOrderLineId === line.purchaseOrderLineId,
        );
        qtyToInvoice = reqLine ? reqLine.quantityToInvoice : 0;
      } else {
        qtyToInvoice = Math.max(0, receivedQty - prevInvoicedQty);
      }

      if (qtyToInvoice <= 0) {
        continue;
      }

      if (prevInvoicedQty + qtyToInvoice > receivedQty + 0.001) {
        throw new BadRequestException(
          `Cannot invoice more than received quantity for line. Requested: ${qtyToInvoice}, Remaining Received: ${Math.max(0, receivedQty - prevInvoicedQty)}`,
        );
      }

      totalInvoicingNow += qtyToInvoice;

      const price = parseFloat(line.pricePerUnit);
      const disc = parseFloat(line.discountPercentage ?? '0');

      // Resolve GST rate from the line's category
      let gstRate = 0;
      if ((line as any).gstCategoryId) {
        try {
          const cat = await this.gstService.getById(
            (line as any).gstCategoryId,
          );
          gstRate = parseFloat(cat.rate ?? '0');
        } catch {
          // Category not found — fall back to 0% tax
        }
      }

      const pricing = computeLinePrice({
        quantity: qtyToInvoice,
        pricePerUnit: price,
        discountPercentage: disc,
        taxRate: gstRate,
      });

      rawTotal += pricing.amount;
      rawTax += pricing.tax;

      const lineExpAcctId =
        EXPENSE_ROUTING_PRECEDENCE === 'supplier_first'
          ? supplierExpenseAccountId ||
            (line as any).productExpenseAccountId ||
            null
          : (line as any).productExpenseAccountId ||
            supplierExpenseAccountId ||
            null;

      if (lineExpAcctId) {
        const current = expenseByAccountId.get(lineExpAcctId) || 0;
        expenseByAccountId.set(lineExpAcctId, current + pricing.amount);
      } else {
        defaultExpense += pricing.amount;
      }

      invoiceLineValues.push({
        purchaseOrderLineId: line.purchaseOrderLineId,
        quantityInvoiced: String(qtyToInvoice),
        pricePerUnit: String(price),
        amount: String(pricing.amount),
      });

      outboxLineDetails.push({
        purchaseOrderLineId: line.purchaseOrderLineId,
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
          receiptFilename: dto.receiptFilename,
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
      if (isFullyInvoiced && order.stateCode === 'received') {
        await tx
          .update(purchaseOrders)
          .set({ stateCode: 'invoiced', modifiedOn: new Date() })
          .where(eq(purchaseOrders.purchaseOrderId, purchaseOrderId));
      }

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

      await emitEvent(tx, {
        aggregateType: AggregateType.PURCHASE_ORDER,
        aggregateId: purchaseOrderId,
        eventType: EventType.PURCHASE_INVOICED,
        payload: outboxPayload,
        actor,
      });

      return invoice;
    });

    this.logger.log(
      `Native Purchase Bill created: ${internalBillNumber} for PO ${order.orderNumber} securely bounding AP sync`,
    );

    // 5. Post GL journal entry (outside the transaction — GL service has its own tx)
    try {
      const settings = await this.glService.getSettings();
      const effectiveApAccountId =
        supplierApAccountId || settings?.defaultApAccountId;

      if (effectiveApAccountId) {
        const distinctAccountIds = new Set<string>();
        distinctAccountIds.add(effectiveApAccountId);
        if (settings?.defaultTaxAccountId)
          distinctAccountIds.add(settings.defaultTaxAccountId);
        if (settings?.defaultExpenseAccountId)
          distinctAccountIds.add(settings.defaultExpenseAccountId);
        for (const acctId of expenseByAccountId.keys()) {
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

          const apCode = idToCode.get(effectiveApAccountId);
          const defaultExpCode = settings.defaultExpenseAccountId
            ? idToCode.get(settings.defaultExpenseAccountId)
            : undefined;
          const taxCode = settings.defaultTaxAccountId
            ? idToCode.get(settings.defaultTaxAccountId)
            : null;

          if (apCode) {
            const glLines: any[] = [];

            if (defaultExpense > 0 && defaultExpCode) {
              glLines.push({
                accountCode: defaultExpCode,
                debit: defaultExpense,
                credit: 0,
                memo: `Expense (Default): ${internalBillNumber}`,
              });
            }

            for (const [acctId, amount] of expenseByAccountId.entries()) {
              const code = idToCode.get(acctId);
              if (code && amount > 0) {
                glLines.push({
                  accountCode: code,
                  debit: amount,
                  credit: 0,
                  memo: `Expense: ${internalBillNumber}`,
                });
              }
            }

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

    if (invoices.length === 0) return [];

    const invoiceIds = invoices.map((i) => i.invoiceId);
    if (invoiceIds.length > 0) {
      const allLines = await this.db
        .select({
          lineId: purchaseInvoiceLines.invoiceLineId,
          invoiceId: purchaseInvoiceLines.invoiceId,
          purchaseOrderLineId: purchaseInvoiceLines.purchaseOrderLineId,
          quantityInvoiced: purchaseInvoiceLines.quantityInvoiced,
          pricePerUnit: purchaseInvoiceLines.pricePerUnit,
          amount: purchaseInvoiceLines.amount,
        })
        .from(purchaseInvoiceLines)
        .where(
          sql`${purchaseInvoiceLines.invoiceId} IN (${sql.join(
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
}

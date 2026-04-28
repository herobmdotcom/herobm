import { randomUUID } from 'crypto';
import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql, desc, and, inArray, gte, or } from 'drizzle-orm';
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
  goodsReceivedLines,
  purchaseInvoiceReceipts,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { computeLinePrice, EXPENSE_ROUTING_PRECEDENCE } from '@modbm/shared';
import { CreateStandaloneInvoiceDto } from './dto';

@Injectable()
export class PurchaseInvoiceService {
  private readonly logger = new Logger(PurchaseInvoiceService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
    private readonly taxService: TaxCategoriesService,
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
        matchStatus: purchaseInvoiceLines.matchStatus,
        description: purchaseInvoiceLines.description,
        quantityInvoiced: purchaseInvoiceLines.quantityInvoiced,
        pricePerUnit: purchaseInvoiceLines.pricePerUnit,
        amount: purchaseInvoiceLines.amount,
        productId: purchaseInvoiceLines.productId,
        productNumber: coreProducts.productNumber,
        purchaseOrderId: purchaseOrderLineItems.purchaseOrderId,
        purchaseOrderNumber: purchaseOrders.orderNumber,
        purchaseOrderLineId: purchaseInvoiceLines.purchaseOrderLineId,
        goodsReceivedLineId: purchaseInvoiceReceipts.goodsReceivedLineId,
        quantityBilled: purchaseInvoiceReceipts.quantityBilled,
      })
      .from(purchaseInvoiceLines)
      .leftJoin(
        purchaseOrderLineItems,
        eq(
          purchaseInvoiceLines.purchaseOrderLineId,
          purchaseOrderLineItems.purchaseOrderLineId,
        ),
      )
      .leftJoin(
        purchaseOrders,
        eq(
          purchaseOrderLineItems.purchaseOrderId,
          purchaseOrders.purchaseOrderId,
        ),
      )
      .leftJoin(
        coreProducts,
        eq(purchaseInvoiceLines.productId, coreProducts.productId),
      )
      .leftJoin(
        purchaseInvoiceReceipts,
        eq(
          purchaseInvoiceLines.invoiceLineId,
          purchaseInvoiceReceipts.invoiceLineId,
        ),
      )
      .where(eq(purchaseInvoiceLines.invoiceId, invoiceId));

    return { ...invoice, lines };
  }

  /**
   * Fetch all Native ModBM Bills strictly tied to a distinct active purchase order.
   * Finds any invoice that has lines matched to the purchase order.
   */
  async findByOrder(purchaseOrderId: string) {
    const linesRows = await this.db
      .select({
        invoiceId: purchaseInvoiceLines.invoiceId,
      })
      .from(purchaseInvoiceLines)
      .innerJoin(
        purchaseOrderLineItems,
        eq(
          purchaseInvoiceLines.purchaseOrderLineId,
          purchaseOrderLineItems.purchaseOrderLineId,
        ),
      )
      .where(eq(purchaseOrderLineItems.purchaseOrderId, purchaseOrderId));

    const matchedInvoiceIds = [
      ...new Set(linesRows.map((r) => r.invoiceId).filter(Boolean)),
    ];

    if (matchedInvoiceIds.length === 0) return [];

    const invoices = await this.db
      .select()
      .from(purchaseInvoices)
      .where(
        sql`${purchaseInvoices.invoiceId} IN (${sql.join(
          matchedInvoiceIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
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
  /**
   * Creates a standalone draft Purchase Invoice.
   */
  async createDraftInvoice(
    dto: CreateStandaloneInvoiceDto,
    actor: string,
  ): Promise<any> {
    const internalBillNumber = await this.generateBillNumber();

    return this.db.transaction(async (tx: DrizzleDB) => {
      const [invoice] = await tx
        .insert(purchaseInvoices)
        .values({
          invoiceNumber: internalBillNumber,
          vendorId: dto.vendorId,
          supplierInvoiceNumber: dto.supplierInvoiceNumber,
          totalAmount: String(dto.totalAmount),
          taxAmount: String(dto.taxAmount),
          receiptFilename: dto.receiptFilename,
          currencyCode: dto.currencyCode,
          stateCode: 'draft',
          notes: dto.notes,
          purchaseOrderId: dto.purchaseOrderId,
          createdBy: actor,
        })
        .returning();

      if (dto.lines && dto.lines.length > 0) {
        const linesToInsert = dto.lines.map((l: any) => {
          const qty = l.quantityInvoiced;
          const price = l.pricePerUnit;
          // Simple local math, ignoring complex discount logic for raw standalone lines
          const amt = qty * price;
          return {
            invoiceLineId: randomUUID(),
            invoiceId: invoice.invoiceId,
            description: l.description,
            productId: l.productId,
            glAccountId: l.glAccountId,
            quantityInvoiced: String(qty),
            pricePerUnit: String(price),
            amount: String(amt),
            purchaseOrderLineId: l.purchaseOrderLineId,
            matchStatus: l.purchaseOrderLineId ? 'matched' : 'unmatched',
          };
        });

        await tx.insert(purchaseInvoiceLines).values(linesToInsert);
      }

      return invoice;
    });
  }

  /**
   * Posts a draft invoice, validates totals, and creates the GL entries.
   */
  async postInvoice(invoiceId: string, actor: string): Promise<any> {
    const [invoice] = await this.db
      .select()
      .from(purchaseInvoices)
      .where(eq(purchaseInvoices.invoiceId, invoiceId));
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.stateCode !== 'draft')
      throw new BadRequestException('Only draft invoices can be posted');

    const lines = await this.db
      .select()
      .from(purchaseInvoiceLines)
      .where(eq(purchaseInvoiceLines.invoiceId, invoiceId));

    let lineTotal = 0;
    const expenseByAccountId = new Map<string, number>();
    let defaultExpense = 0;

    for (const line of lines) {
      const amt = parseFloat(line.amount);
      lineTotal += amt;

      const acctId = line.glAccountId;
      if (acctId) {
        const current = expenseByAccountId.get(acctId) || 0;
        expenseByAccountId.set(acctId, current + amt);
      } else {
        defaultExpense += amt;
      }
    }

    const headerTotal = parseFloat(invoice.totalAmount || '0');
    const taxAmount = parseFloat(invoice.taxAmount || '0');
    const expectedHeader = lineTotal + taxAmount;

    if (Math.abs(expectedHeader - headerTotal) > 0.01) {
      throw new BadRequestException(
        `Invoice totals mismatch. Header: ${headerTotal.toFixed(2)}, Lines+Tax: ${expectedHeader.toFixed(2)}`,
      );
    }

    // Verify Vendor default AP / Expense Accounts
    const [supp] = await this.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.vendorId, invoice.vendorId));
    const supplierApAccountId = (supp as any)?.defaultApAccountId;
    const supplierExpenseAccountId = (supp as any)?.defaultExpenseAccountId;

    // GL Posting (similar to createBill)
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
        if (supplierExpenseAccountId)
          distinctAccountIds.add(supplierExpenseAccountId);
        for (const acctId of expenseByAccountId.keys())
          distinctAccountIds.add(acctId);

        const settingsIds = Array.from(distinctAccountIds).filter(Boolean);

        if (settingsIds.length > 0) {
          const acctRows = await this.db
            .select({
              glAccountId: glAccounts.glAccountId,
              accountCode: glAccounts.accountCode,
            })
            .from(glAccounts)
            .where(inArray(glAccounts.glAccountId, settingsIds));

          const idToCode = new Map(
            acctRows.map((a) => [a.glAccountId, a.accountCode]),
          );

          const apCode = idToCode.get(effectiveApAccountId);
          // If no specific line expense, fallback to supplier's default expense, or system default
          const fallbackExpCode =
            (supplierExpenseAccountId &&
              idToCode.get(supplierExpenseAccountId)) ||
            (settings.defaultExpenseAccountId &&
              idToCode.get(settings.defaultExpenseAccountId));

          const taxCode = settings.defaultTaxAccountId
            ? idToCode.get(settings.defaultTaxAccountId)
            : null;

          if (apCode) {
            const glLines: any[] = [];

            if (defaultExpense > 0 && fallbackExpCode) {
              glLines.push({
                accountCode: fallbackExpCode,
                debit: defaultExpense,
                credit: 0,
                memo: `Expense (Default): ${invoice.invoiceNumber}`,
              });
            }

            for (const [acctId, amount] of expenseByAccountId.entries()) {
              const code = idToCode.get(acctId);
              if (code && amount > 0) {
                glLines.push({
                  accountCode: code,
                  debit: amount,
                  credit: 0,
                  memo: `Expense: ${invoice.invoiceNumber}`,
                });
              }
            }

            if (taxCode && taxAmount > 0) {
              glLines.push({
                accountCode: taxCode,
                debit: taxAmount,
                credit: 0,
                memo: `Tax: ${invoice.invoiceNumber}`,
              });
            }

            // AP Credit
            const totalDebits = glLines.reduce((sum, l) => sum + l.debit, 0);
            glLines.push({
              accountCode: apCode,
              debit: 0,
              credit: totalDebits,
              memo: `Accounts Payable: ${invoice.invoiceNumber}`,
              partyId: invoice.vendorId,
              partyType: 'supplier',
            });

            await this.glService.postJournalEntry(glLines, {
              sourceType: 'purchase_invoice',
              sourceId: invoice.invoiceId,
              memo: `Purchase Invoice ${invoice.invoiceNumber}`,
              actor,
            });
          }
        }
      }
    } catch (err) {
      this.logger.error(
        `Failed to route GL for Invoice ${invoice.invoiceNumber}`,
        err,
      );
    }

    // Mark as invoiced
    const [updatedInvoice] = await this.db
      .update(purchaseInvoices)
      .set({ stateCode: 'invoiced' })
      .where(eq(purchaseInvoices.invoiceId, invoiceId))
      .returning();

    return updatedInvoice;
  }

  /**
   * Allocates/matches an existing invoice line to a PO line.
   */
  async resolveInvoiceLine(
    invoiceLineId: string,
    purchaseOrderLineId: string,
    actor: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [line] = await tx
        .select()
        .from(purchaseInvoiceLines)
        .where(eq(purchaseInvoiceLines.invoiceLineId, invoiceLineId));
      if (!line) throw new NotFoundException('Invoice line not found');

      const [poLine] = await tx
        .select()
        .from(purchaseOrderLineItems)
        .where(
          eq(purchaseOrderLineItems.purchaseOrderLineId, purchaseOrderLineId),
        );
      if (!poLine) throw new NotFoundException('PO line not found');

      await tx
        .update(purchaseInvoiceLines)
        .set({
          purchaseOrderLineId,
          productId: poLine.productId,
          matchStatus: 'matched',
        })
        .where(eq(purchaseInvoiceLines.invoiceLineId, invoiceLineId));

      return { success: true };
    });
  }

  /**
   * Un-matches an invoice line.
   */
  async unresolveInvoiceLine(invoiceLineId: string, actor: string) {
    await this.db
      .update(purchaseInvoiceLines)
      .set({
        purchaseOrderLineId: null,
        matchStatus: 'unmatched',
      })
      .where(eq(purchaseInvoiceLines.invoiceLineId, invoiceLineId));
    return { success: true };
  }

  /**
   * Fetch a flattened, global list of Purchase Invoices spanning multiple orders.
   * Useful for the "All Invoices" page and Account Detail tabs.
   */
  async findActiveInvoices(query: {
    days?: number;
    vendorId?: string;
    invoiceId?: string;
    limit?: number;
  }) {
    const { days = 30, vendorId, invoiceId, limit = 100 } = query;

    const conditions: any[] = [];

    // When filtering by specific invoiceId, skip the date range filter
    if (invoiceId) {
      conditions.push(eq(purchaseInvoices.invoiceId, invoiceId));
    } else if (days > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      conditions.push(gte(purchaseInvoices.createdOn, cutoffDate));
    }

    if (vendorId) {
      conditions.push(
        or(
          eq(purchaseInvoices.vendorId, vendorId),
          eq(suppliers.erpnextId, vendorId),
        ),
      );
    }

    const dataQuery = this.db
      .select({
        invoiceId: purchaseInvoices.invoiceId,
        invoiceNumber: purchaseInvoices.invoiceNumber,
        vendorId: purchaseInvoices.vendorId,
        vendorName: suppliers.name,
        supplierInvoiceNumber: purchaseInvoices.supplierInvoiceNumber,
        totalAmount: purchaseInvoices.totalAmount,
        taxAmount: purchaseInvoices.taxAmount,
        currencyCode: purchaseInvoices.currencyCode,
        stateCode: purchaseInvoices.stateCode,
        createdOn: purchaseInvoices.createdOn,
      })
      .from(purchaseInvoices)
      .leftJoin(suppliers, eq(purchaseInvoices.vendorId, suppliers.vendorId))
      .where(and(...conditions))
      .orderBy(desc(purchaseInvoices.createdOn));

    if (limit > 0) {
      return await dataQuery.limit(limit);
    }
    return await dataQuery;
  }
}

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
  systemEvents,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import { GlService } from '../gl/gl.service';
import { evaluatePOLifecycleRules } from '../purchase-orders/purchase-order-lifecycle-rules';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { AppConfigService } from '../settings/app-config.service';
import {
  computeLinePriceForStorage,
  EXPENSE_ROUTING_PRECEDENCE,
  PURCHASE_INVOICE_STATE,
  PURCHASE_INVOICE_TRANSITIONS,
  MATCH_STATUS,
  getValidStates,
} from '@modbm/shared';

const VALID_INVOICE_STATES = getValidStates(PURCHASE_INVOICE_TRANSITIONS);
import { CreateStandaloneInvoiceDto } from './dto';

@Injectable()
export class PurchaseInvoiceService {
  private readonly logger = new Logger(PurchaseInvoiceService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
    private readonly taxService: TaxCategoriesService,
    private readonly appConfig: AppConfigService,
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
  async findOne(invoiceId: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const rows = await db
      .select({
        invoice: purchaseInvoices,
        vendorName: suppliers.name,
      })
      .from(purchaseInvoices)
      .leftJoin(suppliers, eq(purchaseInvoices.vendorId, suppliers.vendorId))
      .where(eq(purchaseInvoices.invoiceId, invoiceId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Bill '${invoiceId}' not found directly.`);
    }

    const invoiceEntity = rows[0].invoice || rows[0];
    const invoice = { ...invoiceEntity, vendorName: rows[0].vendorName };

    // Hydrate explicitly native ModBM line mapping structurally
    const lines = await db
      .select({
        lineId: purchaseInvoiceLines.invoiceLineId,
        matchStatus: purchaseInvoiceLines.matchStatus,
        description: purchaseInvoiceLines.description,
        quantityInvoiced: purchaseInvoiceLines.quantityInvoiced,
        pricePerUnit: purchaseInvoiceLines.pricePerUnit,
        amount: purchaseInvoiceLines.amount,
        productId: purchaseInvoiceLines.productId,
        productNumber: coreProducts.productNumber,
        glAccountId: purchaseInvoiceLines.glAccountId,
        purchaseOrderId: purchaseOrderLineItems.purchaseOrderId,
        purchaseOrderNumber: purchaseOrders.orderNumber,
        purchaseOrderLineId: purchaseInvoiceLines.purchaseOrderLineId,
        goodsReceivedLineId: purchaseInvoiceReceipts.goodsReceivedLineId,
        quantityBilled: purchaseInvoiceReceipts.quantityBilled,
        poLineQuantityOrdered: purchaseOrderLineItems.quantity,
        poLineQuantityReceived: purchaseOrderLineItems.quantityReceived,
        poLinePricePerUnit: purchaseOrderLineItems.pricePerUnit,
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
          productId: purchaseInvoiceLines.productId,
          productNumber: coreProducts.productNumber,
          description: purchaseInvoiceLines.description,
          poLineDescription: purchaseOrderLineItems.productDescription,
          purchaseOrderId: purchaseOrderLineItems.purchaseOrderId,
          purchaseOrderNumber: purchaseOrders.orderNumber,
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
          outstandingAmount: String(dto.totalAmount),
          taxAmount: String(dto.taxAmount),
          receiptFilename: dto.receiptFilename,
          currencyCode: dto.currencyCode,
          stateCode: PURCHASE_INVOICE_STATE.DRAFT,
          notes: dto.notes,
          purchaseOrderId: dto.purchaseOrderId,
          createdBy: actor,
        })
        .returning();

      if (dto.lines && dto.lines.length > 0) {
        const linesToInsert = dto.lines.map((l: any) => {
          const qty = parseFloat(l.quantityInvoiced || '0');
          const price = parseFloat(l.pricePerUnit || '0');
          const pricing = computeLinePriceForStorage({
            quantity: qty,
            pricePerUnit: price,
          });
          return {
            invoiceLineId: randomUUID(),
            invoiceId: invoice.invoiceId,
            description: l.description,
            productId: l.productId,
            glAccountId: l.glAccountId,
            quantityInvoiced: String(qty),
            pricePerUnit: String(price),
            amount: pricing.amount,
            purchaseOrderLineId: l.purchaseOrderLineId,
            matchStatus: l.purchaseOrderLineId
              ? MATCH_STATUS.MATCHED
              : MATCH_STATUS.UNMATCHED,
          };
        });

        await tx.insert(purchaseInvoiceLines).values(linesToInsert);
      }

      await emitEvent(tx as any, {
        aggregateType: AggregateType.PURCHASE_INVOICE,
        aggregateId: invoice.invoiceId,
        eventType: EventType.STATUS_CHANGED,
        payload: {
          entity: 'purchase_invoice',
          entityId: invoice.invoiceId,
          from: null,
          to: PURCHASE_INVOICE_STATE.DRAFT,
        },
        actor,
      });

      return invoice;
    });
  }

  private async recalculateInvoiceTotals(invoiceId: string, tx: any) {
    const lines = await tx
      .select({ amount: purchaseInvoiceLines.amount })
      .from(purchaseInvoiceLines)
      .where(eq(purchaseInvoiceLines.invoiceId, invoiceId));

    let lineTotal = 0;
    for (const line of lines) {
      lineTotal += parseFloat(line.amount || '0');
    }

    const [invoice] = await tx
      .select()
      .from(purchaseInvoices)
      .where(eq(purchaseInvoices.invoiceId, invoiceId));

    const taxAmt = parseFloat(invoice.taxAmount || '0');
    const newTotal = lineTotal + taxAmt;

    await tx
      .update(purchaseInvoices)
      .set({
        totalAmount: newTotal.toFixed(2),
        outstandingAmount: newTotal.toFixed(2),
      })
      .where(eq(purchaseInvoices.invoiceId, invoiceId));
  }

  async updateInvoice(invoiceId: string, dto: any, actor: string) {
    return this.db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.invoiceId, invoiceId));
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.stateCode !== PURCHASE_INVOICE_STATE.DRAFT)
        throw new BadRequestException('Only draft invoices can be updated');

      const updateData: any = {};
      if (dto.supplierInvoiceNumber !== undefined)
        updateData.supplierInvoiceNumber = dto.supplierInvoiceNumber;
      if (dto.receiptFilename !== undefined)
        updateData.receiptFilename = dto.receiptFilename;
      if (dto.notes !== undefined) updateData.notes = dto.notes;
      if (dto.taxAmount !== undefined) updateData.taxAmount = dto.taxAmount;
      if (dto.currencyCode !== undefined)
        updateData.currencyCode = dto.currencyCode;
      if (dto.vendorId !== undefined) updateData.vendorId = dto.vendorId;

      if (Object.keys(updateData).length > 0) {
        await tx
          .update(purchaseInvoices)
          .set(updateData)
          .where(eq(purchaseInvoices.invoiceId, invoiceId));

        if (updateData.taxAmount !== undefined) {
          await this.recalculateInvoiceTotals(invoiceId, tx);
        }
      }

      return this.findOne(invoiceId);
    });
  }

  async updateLine(invoiceId: string, lineId: string, dto: any, actor: string) {
    return this.db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.invoiceId, invoiceId));
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.stateCode !== PURCHASE_INVOICE_STATE.DRAFT)
        throw new BadRequestException(
          'Only draft invoice lines can be updated',
        );

      const [line] = await tx
        .select()
        .from(purchaseInvoiceLines)
        .where(eq(purchaseInvoiceLines.invoiceLineId, lineId));
      if (!line) throw new NotFoundException('Line not found');

      const updateData: any = {};
      if (dto.description !== undefined)
        updateData.description = dto.description;
      if (dto.glAccountId !== undefined)
        updateData.glAccountId = dto.glAccountId;
      if (dto.productId !== undefined) updateData.productId = dto.productId;

      let qty = parseFloat(line.quantityInvoiced);
      let price = parseFloat(line.pricePerUnit);

      if (dto.quantityInvoiced !== undefined) {
        updateData.quantityInvoiced = String(dto.quantityInvoiced);
        qty = parseFloat(dto.quantityInvoiced);
      }
      if (dto.pricePerUnit !== undefined) {
        updateData.pricePerUnit = String(dto.pricePerUnit);
        price = parseFloat(dto.pricePerUnit);
      }

      if (
        dto.quantityInvoiced !== undefined ||
        dto.pricePerUnit !== undefined
      ) {
        const pricing = computeLinePriceForStorage({
          quantity: qty,
          pricePerUnit: price,
        });
        updateData.amount = pricing.amount;
      }

      await tx
        .update(purchaseInvoiceLines)
        .set(updateData)
        .where(eq(purchaseInvoiceLines.invoiceLineId, lineId));

      if (updateData.amount !== undefined) {
        await this.recalculateInvoiceTotals(invoiceId, tx);
      }

      return { success: true };
    });
  }

  async removeLine(invoiceId: string, lineId: string, actor: string) {
    return this.db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.invoiceId, invoiceId));
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.stateCode !== PURCHASE_INVOICE_STATE.DRAFT)
        throw new BadRequestException(
          'Only draft invoice lines can be removed',
        );

      await tx
        .delete(purchaseInvoiceLines)
        .where(eq(purchaseInvoiceLines.invoiceLineId, lineId));

      await this.recalculateInvoiceTotals(invoiceId, tx);

      return { success: true };
    });
  }

  async addLine(invoiceId: string, dto: any, actor: string) {
    return this.db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.invoiceId, invoiceId));
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.stateCode !== PURCHASE_INVOICE_STATE.DRAFT)
        throw new BadRequestException('Only draft invoice lines can be added');

      const qty = parseFloat(dto.quantityInvoiced || '1');
      const price = parseFloat(dto.pricePerUnit || '0');
      const pricing = computeLinePriceForStorage({
        quantity: qty,
        pricePerUnit: price,
      });

      let defaultGlAccountId = dto.glAccountId || null;
      if (!defaultGlAccountId) {
        const settings = await this.glService.getSettings();
        if (settings?.defaultExpenseAccountId) {
          defaultGlAccountId = settings.defaultExpenseAccountId;
        } else {
          // Fallback to the first expense account if no default is configured
          const fallbackRows = await tx
            .select({ id: glAccounts.glAccountId })
            .from(glAccounts)
            .where(eq(glAccounts.accountType, 'expense'))
            .limit(1);
          if (fallbackRows.length > 0) {
            defaultGlAccountId = fallbackRows[0].id;
          }
        }
      }

      await tx.insert(purchaseInvoiceLines).values({
        invoiceLineId: randomUUID(),
        invoiceId,
        description: dto.description || '',
        productId: dto.productId || null,
        glAccountId: defaultGlAccountId,
        quantityInvoiced: String(qty),
        pricePerUnit: String(price),
        amount: pricing.amount,
        matchStatus: MATCH_STATUS.UNMATCHED,
      });

      await this.recalculateInvoiceTotals(invoiceId, tx);

      return { success: true };
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
    if (invoice.stateCode !== PURCHASE_INVOICE_STATE.DRAFT)
      throw new BadRequestException('Only draft invoices can be posted');

    const lines = await this.db
      .select({
        line: purchaseInvoiceLines,
        poProductId: purchaseOrderLineItems.productId,
      })
      .from(purchaseInvoiceLines)
      .leftJoin(
        purchaseOrderLineItems,
        eq(
          purchaseInvoiceLines.purchaseOrderLineId,
          purchaseOrderLineItems.purchaseOrderLineId,
        ),
      )
      .where(eq(purchaseInvoiceLines.invoiceId, invoiceId));

    let lineTotal = 0;
    const expenseByAccountId = new Map<string, number>();
    let defaultExpense = 0;
    let grniExpense = 0;

    for (const { line, poProductId } of lines) {
      if (line.matchStatus !== MATCH_STATUS.MATCHED && !line.glAccountId) {
        throw new BadRequestException(
          `Line "${line.description}" is unmatched and must have a GL Account assigned before finalisation.`,
        );
      }

      const amt = parseFloat(line.amount);
      lineTotal += amt;

      const acctId = line.glAccountId;
      if (acctId) {
        const current = expenseByAccountId.get(acctId) || 0;
        expenseByAccountId.set(acctId, current + amt);
      } else if (line.matchStatus === MATCH_STATUS.MATCHED && poProductId) {
        grniExpense += amt;
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

    // Verify Vendor default AP / Expense Accounts + Dimensions
    const [supp] = await this.db
      .select({
        vendorId: suppliers.vendorId,
        defaultApAccountId: supplierGroups.defaultApAccountId,
        defaultExpenseAccountId: supplierGroups.defaultExpenseAccountId,
        supplierCostCenterId: supplierGroups.defaultCostCenterId,
        supplierActivityId: supplierGroups.defaultActivityId,
      })
      .from(suppliers)
      .leftJoin(
        supplierGroups,
        eq(suppliers.supplierGroupId, supplierGroups.supplierGroupId),
      )
      .where(eq(suppliers.vendorId, invoice.vendorId));
    const supplierApAccountId = supp?.defaultApAccountId;
    const supplierExpenseAccountId = supp?.defaultExpenseAccountId;
    const supplierCostCenterId = supp?.supplierCostCenterId || null;
    const supplierActivityId = supp?.supplierActivityId || null;

    // GL Posting + State Update (atomic transaction)
    const updatedInvoice = await this.db.transaction(async (tx: DrizzleDB) => {
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
        if (settings?.defaultGrniAccountId)
          distinctAccountIds.add(settings.defaultGrniAccountId);
        if (supplierExpenseAccountId)
          distinctAccountIds.add(supplierExpenseAccountId);
        for (const acctId of expenseByAccountId.keys())
          distinctAccountIds.add(acctId);

        const settingsIds = Array.from(distinctAccountIds).filter(Boolean);

        if (settingsIds.length > 0) {
          const acctRows = await tx
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

          // In perpetual mode, matched inventory lines clear the GRNI liability.
          // In periodic mode, matched lines are treated as direct expenses.
          const isPerpetual =
            this.appConfig.inventoryAccountingMode() === 'perpetual';
          const grniCode =
            isPerpetual && settings.defaultGrniAccountId
              ? idToCode.get(settings.defaultGrniAccountId)
              : fallbackExpCode; // Periodic: route through expense

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
                costCenterId: supplierCostCenterId || undefined,
                activityId: supplierActivityId || undefined,
              });
            }

            if (grniExpense > 0 && grniCode) {
              glLines.push({
                accountCode: grniCode,
                debit: grniExpense,
                credit: 0,
                memo: `GRNI Clearance: ${invoice.invoiceNumber}`,
                partyId: invoice.vendorId,
                partyType: 'supplier',
                costCenterId: supplierCostCenterId || undefined,
                activityId: supplierActivityId || undefined,
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
                  costCenterId: supplierCostCenterId || undefined,
                  activityId: supplierActivityId || undefined,
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
              costCenterId: supplierCostCenterId || undefined,
              activityId: supplierActivityId || undefined,
            });

            await this.glService.postJournalEntry(
              glLines,
              {
                sourceType: 'purchase_invoice',
                sourceId: invoice.invoiceId,
                memo: `Purchase Invoice ${invoice.invoiceNumber}`,
                actor,
              },
              tx,
            );
          }
        }
      }

      // Mark as invoiced (atomic with GL posting)
      await this.changePurchaseInvoiceStateInternal(
        invoiceId,
        PURCHASE_INVOICE_STATE.INVOICED,
        actor,
        tx,
      );

      if (invoice.purchaseOrderId) {
        await evaluatePOLifecycleRules(
          tx,
          invoice.purchaseOrderId,
          { entity: 'purchase_invoice', action: 'posted' },
          actor,
        );
      }

      return this.findOne(invoiceId, tx);
    });

    // Trigger lifecycle rules for affected POs (non-fatal side effect)
    const affectedPoIds = [
      ...new Set(
        ((invoice as any).lines || [])
          .map((l: any) => l.purchaseOrderId)
          .filter(Boolean),
      ),
    ] as string[];

    for (const poId of affectedPoIds) {
      try {
        await evaluatePOLifecycleRules(
          this.db,
          poId,
          {
            entity: 'purchase_invoice',
            action: 'posted',
            id: invoiceId,
          },
          actor,
        );
      } catch (err) {
        this.logger.error(
          `Failed to evaluate PO lifecycle rules for PO ${poId} after invoice posting:`,
          err,
        );
      }
    }

    return updatedInvoice;
  }

  /**
   * Changes the state of a Purchase Invoice.
   * Handles draft -> cancelled, cancelled -> draft.
   * draft -> invoiced delegates to postInvoice.
   */
  async changePurchaseInvoiceState(
    invoiceId: string,
    newState: string,
    actor: string,
    discrepanciesAcknowledged?: boolean,
    tx?: DrizzleDB,
  ) {
    const fullInvoice = await this.findOne(invoiceId, tx);
    if (!fullInvoice) throw new NotFoundException('Invoice not found');
    const invoice = fullInvoice as any; // Full invoice with lines

    const allowed = PURCHASE_INVOICE_TRANSITIONS[invoice.stateCode] || [];
    if (!allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition invoice from ${invoice.stateCode} to ${newState}`,
      );
    }

    const db = tx || this.db;
    // Check for discrepancies on forward transition
    if (
      newState !== PURCHASE_INVOICE_STATE.DRAFT &&
      newState !== PURCHASE_INVOICE_STATE.CANCELLED
    ) {
      const discrepancies: any[] = [];
      invoice.lines.forEach((line: any, idx: number) => {
        if (
          line.matchStatus !== MATCH_STATUS.MATCHED &&
          !line.purchaseOrderLineId &&
          parseFloat(line.amount || '0') > 0
        ) {
          discrepancies.push({
            type: 'unplanned_line',
            message: `Line ${idx + 1} is unplanned.`,
          });
        }
        if (
          line.matchStatus === MATCH_STATUS.MATCHED &&
          line.purchaseOrderLineId
        ) {
          const billedQty = parseFloat(line.quantityInvoiced || '0');
          const poReceived = parseFloat(line.poLineQuantityReceived || '0');
          const billedPrice = parseFloat(line.pricePerUnit || '0');
          const poPrice = parseFloat(line.poLinePricePerUnit || '0');

          if (Math.abs(billedPrice - poPrice) > 0.001) {
            discrepancies.push({
              type: 'price_variance',
              message: `Line ${idx + 1} price variance.`,
            });
          }
          if (billedQty > poReceived) {
            discrepancies.push({
              type: 'quantity_variance',
              message: `Line ${idx + 1} quantity variance.`,
            });
          }
        }
      });

      if (discrepancies.length > 0) {
        if (!discrepanciesAcknowledged) {
          throw new BadRequestException('Unacknowledged discrepancies exist.');
        }

        // Log the approval of discrepancies
        await db.insert(systemEvents).values({
          eventType: 'invoice_discrepancy_approved',
          aggregateType: 'purchase_invoice',
          aggregateId: invoiceId,
          actor,
          payload: {
            discrepancies,
            purchaseOrderId: invoice.lines[0]?.purchaseOrderId,
          },
        });
      }
    }

    if (newState === PURCHASE_INVOICE_STATE.INVOICED) {
      return this.postInvoice(invoiceId, actor);
    }

    return this.changePurchaseInvoiceStateInternal(
      invoiceId,
      newState,
      actor,
      db,
    );
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
          matchStatus: MATCH_STATUS.MATCHED,
        })
        .where(eq(purchaseInvoiceLines.invoiceLineId, invoiceLineId));

      await emitEvent(tx, {
        aggregateType: AggregateType.PURCHASE_ORDER,
        aggregateId: poLine.purchaseOrderId,
        eventType: EventType.INVOICE_MATCHED,
        actor,
        payload: {
          invoiceLineId,
          purchaseOrderLineId,
          invoiceId: line.invoiceId,
        },
      });

      return { success: true };
    });
  }

  /**
   * Auto-matches unbilled lines from a given PO to this invoice.
   */
  async autoMatchPurchaseOrder(
    invoiceId: string,
    purchaseOrderId: string,
    actor: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.invoiceId, invoiceId));
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.stateCode !== PURCHASE_INVOICE_STATE.DRAFT)
        throw new BadRequestException(
          'Only draft invoices can be auto-matched',
        );

      // 1. Fetch PO Lines
      const poLines = await tx
        .select()
        .from(purchaseOrderLineItems)
        .where(eq(purchaseOrderLineItems.purchaseOrderId, purchaseOrderId));

      // 2. Fetch existing unmatched invoice lines
      const invLines = await tx
        .select()
        .from(purchaseInvoiceLines)
        .where(eq(purchaseInvoiceLines.invoiceId, invoiceId));

      let matchedCount = 0;
      let addedCount = 0;

      for (const poLine of poLines) {
        // Find if we already have an unmatched invoice line for this product
        const match = invLines.find(
          (l) =>
            l.matchStatus === MATCH_STATUS.UNMATCHED &&
            l.productId === poLine.productId,
        );

        if (match) {
          await tx
            .update(purchaseInvoiceLines)
            .set({
              purchaseOrderLineId: poLine.purchaseOrderLineId,
              matchStatus: MATCH_STATUS.MATCHED,
            })
            .where(eq(purchaseInvoiceLines.invoiceLineId, match.invoiceLineId));
          match.matchStatus = MATCH_STATUS.MATCHED; // Prevent mapping to this line again
          matchedCount++;
        } else {
          // Add it as a new matched line
          const qty = parseFloat(poLine.quantity || '0');
          const price = parseFloat(poLine.pricePerUnit || '0');
          const pricing = computeLinePriceForStorage({
            quantity: qty,
            pricePerUnit: price,
          });

          await tx.insert(purchaseInvoiceLines).values({
            invoiceLineId: randomUUID(),
            invoiceId,
            description: poLine.productDescription || '',
            productId: poLine.productId,
            glAccountId: null,
            quantityInvoiced: String(qty),
            pricePerUnit: String(price),
            amount: pricing.amount,
            purchaseOrderLineId: poLine.purchaseOrderLineId,
            matchStatus: MATCH_STATUS.MATCHED,
          });
          addedCount++;
        }
      }

      await this.recalculateInvoiceTotals(invoiceId, tx);

      if (matchedCount > 0 || addedCount > 0) {
        await emitEvent(tx, {
          aggregateType: AggregateType.PURCHASE_ORDER,
          aggregateId: purchaseOrderId,
          eventType: EventType.INVOICE_MATCHED,
          actor,
          payload: {
            invoiceId,
            matchedCount,
            addedCount,
          },
        });
      }

      return { success: true, matchedCount, addedCount };
    });
  }

  /**
   * Un-matches an invoice line.
   */
  async unresolveInvoiceLine(invoiceLineId: string, actor: string) {
    return this.db.transaction(async (tx) => {
      const [line] = await tx
        .select({
          invoiceId: purchaseInvoiceLines.invoiceId,
          purchaseOrderLineId: purchaseInvoiceLines.purchaseOrderLineId,
        })
        .from(purchaseInvoiceLines)
        .where(eq(purchaseInvoiceLines.invoiceLineId, invoiceLineId));

      if (!line) throw new NotFoundException('Invoice line not found');

      let poId: string | null = null;
      if (line.purchaseOrderLineId) {
        const [poLine] = await tx
          .select({ purchaseOrderId: purchaseOrderLineItems.purchaseOrderId })
          .from(purchaseOrderLineItems)
          .where(
            eq(
              purchaseOrderLineItems.purchaseOrderLineId,
              line.purchaseOrderLineId,
            ),
          );
        if (poLine) poId = poLine.purchaseOrderId;
      }

      await tx
        .update(purchaseInvoiceLines)
        .set({
          purchaseOrderLineId: null,
          matchStatus: MATCH_STATUS.UNMATCHED,
        })
        .where(eq(purchaseInvoiceLines.invoiceLineId, invoiceLineId));

      if (poId) {
        await emitEvent(tx, {
          aggregateType: AggregateType.PURCHASE_ORDER,
          aggregateId: poId,
          eventType: EventType.INVOICE_UNMATCHED,
          actor,
          payload: {
            invoiceLineId,
            invoiceId: line.invoiceId,
          },
        });
      }

      return { success: true };
    });
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
          eq(suppliers.externalId, vendorId),
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
        outstandingAmount: purchaseInvoices.outstandingAmount,
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

  private async changePurchaseInvoiceStateInternal(
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
        stateCode: purchaseInvoices.stateCode,
        invoiceNumber: purchaseInvoices.invoiceNumber,
      })
      .from(purchaseInvoices)
      .where(eq(purchaseInvoices.invoiceId, invoiceId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    const allowed = PURCHASE_INVOICE_TRANSITIONS[existing.stateCode];
    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition invoice from '${existing.stateCode}' to '${newState}'. Allowed transitions: ${allowed?.join(', ') || 'none'}`,
      );
    }

    const [updated] = await db
      .update(purchaseInvoices)
      .set({
        // eslint-disable-next-line no-restricted-syntax
        stateCode: newState as any,
        modifiedOn: new Date(),
      })
      .where(eq(purchaseInvoices.invoiceId, invoiceId))
      .returning();

    await emitEvent(db as any, {
      aggregateType: AggregateType.PURCHASE_INVOICE,
      aggregateId: invoiceId,
      eventType: EventType.STATUS_CHANGED,
      payload: {
        entity: 'purchase_invoice',
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

import { randomUUID } from 'crypto';
import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  eq,
  sql,
  desc,
  and,
  inArray,
  gte,
  or,
  asc,
  lt,
  gt,
  ilike,
} from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrders,
  purchaseInvoices,
  purchaseInvoiceLines,
  purchaseOrderLineItems,
  outbox,
  suppliers,
  supplierGroups,
  products as coreProducts,
  productGroups,
  glAccounts,
  goodsReceivedLines,
  purchaseInvoiceReceipts,
  systemEvents,
  paymentAllocations,
  paymentEntries,
  glJournalEntries,
  glJournalLines,
  tradingTerms,
} from '../drizzle/herobm-core-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { GlService } from '../gl/gl.service';
import { evaluatePOLifecycleRules } from '../purchase-orders/purchase-order-lifecycle-rules';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { AppConfigService } from '../settings/app-config.service';

import { getExchangeRateForCurrency } from '../common/fx-helper';
import {
  computeLinePriceForStorage,
  EXPENSE_ROUTING_PRECEDENCE,
  PURCHASE_INVOICE_STATE,
  PURCHASE_INVOICE_TRANSITIONS,
  MATCH_STATUS,
  getValidStates,
} from '@herobm/shared';
import { withCursorPagination } from '../common/pagination';
import { calculateDueDate } from '../settings/trading-terms.utils';
import {
  resolveEffectiveTradingTermsId,
  resolveEffectiveEarlyPaymentDiscount,
} from '../customers/credit-control.utils';
import { resolveGlDimensions } from '../common/utils/gl-resolution.util';

const VALID_INVOICE_STATES = getValidStates(PURCHASE_INVOICE_TRANSITIONS);
import { CreateStandaloneInvoiceDto } from './dto';
import { getAccountingStrategy } from '../inventory/inventory-accounting';
import type { InventoryGlAccounts } from '../inventory/inventory-accounting';

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
   * Generates a structural sequence number for the internal AP bill record natively in HeroBM.
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
   * Fetch a specific HeroBM AP Bill with natively populated mappings structurally
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

    // Hydrate explicitly native HeroBM line mapping structurally
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

    const allocations = await db
      .select({
        allocationId: paymentAllocations.allocationId,
        allocatedAmount: paymentAllocations.allocatedAmount,
        paymentId: paymentEntries.paymentId,
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
          eq(paymentAllocations.referenceType, 'purchase_invoice'),
        ),
      );

    return { ...invoice, lines, allocations };
  }

  /**
   * Fetch all Native HeroBM Bills strictly tied to a distinct active purchase order.
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

      const groupedLines = new Map<string, (typeof allLines)[0][]>();
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
  ): Promise<typeof purchaseInvoices.$inferSelect> {
    const internalBillNumber = await this.generateBillNumber();

    let vendorTermType: string | null = null;
    let vendorTermDays: number | null = null;
    let earlyPaymentDiscount: string | null = null;
    let earlyPaymentDiscountDays: number | null = null;

    if (dto.vendorId) {
      const vendRows = await this.db
        .select({
          tradingTermsId: suppliers.tradingTermsId,
          groupTradingTermsId: supplierGroups.tradingTermsId,
          earlyPaymentDiscount: suppliers.earlyPaymentDiscount,
          earlyPaymentDiscountDays: suppliers.earlyPaymentDiscountDays,
          groupEarlyPaymentDiscount: supplierGroups.earlyPaymentDiscount,
          groupEarlyPaymentDiscountDays:
            supplierGroups.earlyPaymentDiscountDays,
        })
        .from(suppliers)
        .leftJoin(
          supplierGroups,
          eq(suppliers.supplierGroupId, supplierGroups.supplierGroupId),
        )
        .where(eq(suppliers.vendorId, dto.vendorId))
        .limit(1);

      if (vendRows.length > 0) {
        const effectiveEarlyPaymentDiscount =
          resolveEffectiveEarlyPaymentDiscount({
            earlyPaymentDiscount: vendRows[0].earlyPaymentDiscount,
            earlyPaymentDiscountDays: vendRows[0].earlyPaymentDiscountDays,
            accountGroup: {
              earlyPaymentDiscount: vendRows[0].groupEarlyPaymentDiscount,
              earlyPaymentDiscountDays:
                vendRows[0].groupEarlyPaymentDiscountDays,
            },
          });
        earlyPaymentDiscount =
          effectiveEarlyPaymentDiscount.earlyPaymentDiscount;
        earlyPaymentDiscountDays =
          effectiveEarlyPaymentDiscount.earlyPaymentDiscountDays;

        const effectiveTermsId =
          vendRows[0].tradingTermsId ||
          vendRows[0].groupTradingTermsId ||
          this.appConfig.getAppSettingsRaw()?.defaultSupplierTermsId;

        if (effectiveTermsId) {
          const [term] = await this.db
            .select()
            .from(tradingTerms)
            .where(eq(tradingTerms.tradingTermsId, effectiveTermsId))
            .limit(1);
          if (term) {
            vendorTermType = term.type as
              | 'net'
              | 'end_of_month'
              | 'cash_on_delivery';
            vendorTermDays = term.days;
          }
        }
      }
    }

    return this.db.transaction(async (tx: DrizzleDB) => {
      const invoiceDate = dto.invoiceDate
        ? new Date(dto.invoiceDate)
        : new Date();
      let dueDate = new Date();
      if (vendorTermType && vendorTermDays !== null) {
        console.log(
          'Calculating due date for vendor',
          dto.vendorId,
          'type',
          vendorTermType,
          'days',
          vendorTermDays,
        );
        dueDate = calculateDueDate(invoiceDate, vendorTermType, vendorTermDays);
      } else {
        console.log(
          'Falling back to new Date for vendor',
          dto.vendorId,
          'vendorTermType',
          vendorTermType,
        );
      }

      const piCurrencyCode = dto.currencyCode || this.appConfig.homeCurrency();
      const fx = await getExchangeRateForCurrency(
        tx,
        piCurrencyCode,
        invoiceDate || new Date(),
      );

      const baseTotalAmount = (
        parseFloat(dto.totalAmount.toString()) * fx.rate
      ).toFixed(2);

      const [invoice] = await tx
        .insert(purchaseInvoices)
        .values({
          invoiceNumber: internalBillNumber,
          vendorId: dto.vendorId,
          supplierInvoiceNumber: dto.supplierInvoiceNumber,
          totalAmount: String(dto.totalAmount),
          outstandingAmount: String(dto.totalAmount),
          taxAmount: String(dto.taxAmount),
          baseTotalAmount: baseTotalAmount,
          baseOutstandingAmount: baseTotalAmount,
          receiptFilename: dto.receiptFilename,
          currencyCode: piCurrencyCode,
          exchangeRate: fx.rate.toString(),
          stateCode: PURCHASE_INVOICE_STATE.DRAFT,
          notes: dto.notes,
          purchaseOrderId: dto.purchaseOrderId,
          invoiceDate,
          dueDate,
          earlyPaymentDiscount,
          earlyPaymentDiscountDays,
          createdBy: actor,
        })
        .returning();

      if (dto.lines && dto.lines.length > 0) {
        const linesToInsert = dto.lines.map((l) => {
          const qty = parseFloat(String(l.quantityInvoiced || '0'));
          const price = parseFloat(String(l.pricePerUnit || '0'));
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

      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_INVOICE,
        entityId: invoice.invoiceId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: invoice.invoiceNumber,
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

  // @herobm-skip-audit
  private async recalculateInvoiceTotals(invoiceId: string, tx: DrizzleDB) {
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

    // @herobm-skip-audit
    await tx
      .update(purchaseInvoices)
      .set({
        totalAmount: newTotal.toFixed(2),
        outstandingAmount: newTotal.toFixed(2),
      })
      .where(eq(purchaseInvoices.invoiceId, invoiceId));
  }

  async updateInvoice(
    invoiceId: string,
    dto: {
      supplierInvoiceNumber?: string;
      receiptFilename?: string;
      notes?: string;
      taxAmount?: string;
      currencyCode?: string;
      vendorId?: string;
    },
    actor: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.invoiceId, invoiceId));
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.stateCode !== PURCHASE_INVOICE_STATE.DRAFT)
        throw new BadRequestException('Only draft invoices can be updated');

      const updateData: Partial<typeof purchaseInvoices.$inferInsert> = {};
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

      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_INVOICE,
        entityId: invoiceId,
        eventType: EventType.UPDATED,
        entityDisplayName: invoice.invoiceNumber,
        payload: { action: 'updateInvoice', invoiceId },
        actor,
      });

      return this.findOne(invoiceId);
    });
  }

  async updateLine(
    invoiceId: string,
    lineId: string,
    dto: {
      description?: string;
      glAccountId?: string;
      productId?: string;
      quantityInvoiced?: string | number;
      pricePerUnit?: string | number;
    },
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
          'Only draft invoice lines can be updated',
        );

      const [line] = await tx
        .select()
        .from(purchaseInvoiceLines)
        .where(eq(purchaseInvoiceLines.invoiceLineId, lineId));
      if (!line) throw new NotFoundException('Line not found');

      const updateData: Partial<typeof purchaseInvoiceLines.$inferInsert> = {};
      if (dto.description !== undefined)
        updateData.description = dto.description;
      if (dto.glAccountId !== undefined)
        updateData.glAccountId = dto.glAccountId;
      if (dto.productId !== undefined) updateData.productId = dto.productId;

      let qty = parseFloat(line.quantityInvoiced);
      let price = parseFloat(line.pricePerUnit);

      if (dto.quantityInvoiced !== undefined) {
        updateData.quantityInvoiced = String(dto.quantityInvoiced);
        qty = parseFloat(String(dto.quantityInvoiced));
      }
      if (dto.pricePerUnit !== undefined) {
        updateData.pricePerUnit = String(dto.pricePerUnit);
        price = parseFloat(String(dto.pricePerUnit));
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

      // @herobm-skip-audit
      await tx
        .update(purchaseInvoiceLines)
        .set(updateData)
        .where(eq(purchaseInvoiceLines.invoiceLineId, lineId));

      if (updateData.amount !== undefined) {
        await this.recalculateInvoiceTotals(invoiceId, tx);
      }

      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_INVOICE,
        entityId: invoiceId,
        eventType: EventType.LINE_UPDATED,
        entityDisplayName: invoice.invoiceNumber,
        payload: { action: 'updateLine', lineId },
        actor,
      });

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

      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_INVOICE,
        entityId: invoiceId,
        eventType: EventType.LINE_REMOVED,
        entityDisplayName: invoice.invoiceNumber,
        payload: { action: 'removeLine', lineId },
        actor,
      });

      return { success: true };
    });
  }

  async addLine(
    invoiceId: string,
    dto: {
      description?: string;
      glAccountId?: string;
      productId?: string;
      quantityInvoiced?: string | number;
      pricePerUnit?: string | number;
    },
    actor: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.invoiceId, invoiceId));
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.stateCode !== PURCHASE_INVOICE_STATE.DRAFT)
        throw new BadRequestException('Only draft invoice lines can be added');

      const qty = parseFloat(String(dto.quantityInvoiced || '1'));
      const price = parseFloat(String(dto.pricePerUnit || '0'));
      const pricing = computeLinePriceForStorage({
        quantity: qty,
        pricePerUnit: price,
      });

      let defaultGlAccountId = dto.glAccountId || null;
      if (!defaultGlAccountId) {
        const settings = await this.glService.getSettings(tx);
        if (settings?.defaultExpenseAccountId) {
          defaultGlAccountId = settings.defaultExpenseAccountId;
        } else {
          // Fallback to the first expense customer if no default is configured
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

      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_INVOICE,
        entityId: invoiceId,
        eventType: EventType.LINE_ADDED,
        entityDisplayName: invoice.invoiceNumber,
        payload: { action: 'addLine' },
        actor,
      });

      return { success: true };
    });
  }

  /**
   * Posts a draft invoice, validates totals, and creates the GL entries.
   */
  async postInvoice(invoiceId: string, actor: string) {
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
        productExpenseAccountId: productGroups.defaultExpenseAccountId,
        productCostCenterId: productGroups.defaultCostCenterId,
        productActivityId: productGroups.defaultActivityId,
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
        coreProducts,
        eq(
          coreProducts.productId,
          purchaseInvoiceLines.productId || purchaseOrderLineItems.productId,
        ),
      )
      .leftJoin(
        productGroups,
        eq(coreProducts.productGroupId, productGroups.productGroupId),
      )
      .where(eq(purchaseInvoiceLines.invoiceId, invoiceId));

    const receipts = await this.db
      .select({
        invoiceLineId: purchaseInvoiceReceipts.invoiceLineId,
        quantityBilled: purchaseInvoiceReceipts.quantityBilled,
        unitCost: goodsReceivedLines.unitCost,
        poExchangeRate: purchaseOrders.exchangeRate,
      })
      .from(purchaseInvoiceReceipts)
      .innerJoin(
        goodsReceivedLines,
        eq(
          purchaseInvoiceReceipts.goodsReceivedLineId,
          goodsReceivedLines.goodsReceivedLineId,
        ),
      )
      .innerJoin(
        purchaseInvoiceLines,
        eq(
          purchaseInvoiceReceipts.invoiceLineId,
          purchaseInvoiceLines.invoiceLineId,
        ),
      )
      .leftJoin(
        purchaseOrders,
        eq(goodsReceivedLines.purchaseOrderId, purchaseOrders.purchaseOrderId),
      )
      .where(eq(purchaseInvoiceLines.invoiceId, invoiceId));

    const receiptCosts = new Map<string, { cost: number; poRate: number }>();
    for (const r of receipts) {
      const q = parseFloat(r.quantityBilled);
      const c = parseFloat(r.unitCost || '0');
      const poRate = parseFloat(r.poExchangeRate || '1');
      const existing = receiptCosts.get(r.invoiceLineId) || {
        cost: 0,
        poRate: 1,
      };
      receiptCosts.set(r.invoiceLineId, {
        cost: existing.cost + q * c,
        poRate: poRate,
      });
    }

    let lineTotalForeign = 0;
    const expenseGroups = new Map<
      string,
      {
        foreignAmount: number;
        baseAmount: number;
        accountId: string;
        costCenterId: string | null;
        activityId: string | null;
      }
    >();
    const grniGroups = new Map<
      string,
      {
        baseAmount: number;
        foreignAmount: number;
        costCenterId: string | null;
        activityId: string | null;
      }
    >();
    const defaultExpenseGroups = new Map<
      string,
      {
        foreignAmount: number;
        baseAmount: number;
        costCenterId: string | null;
        activityId: string | null;
      }
    >();
    const ppvGroups = new Map<
      string,
      {
        baseAmount: number;
        costCenterId: string | null;
        activityId: string | null;
      }
    >();
    const fxVarianceGroups = new Map<
      string,
      {
        baseAmount: number;
        costCenterId: string | null;
        activityId: string | null;
      }
    >();

    const invoiceRate = parseFloat(invoice.exchangeRate || '1');

    for (const row of lines) {
      const {
        line,
        poProductId,
        productExpenseAccountId,
        productCostCenterId,
        productActivityId,
      } = row;
      if (line.matchStatus !== MATCH_STATUS.MATCHED && !line.glAccountId) {
        throw new BadRequestException(
          `Line "${line.description}" is unmatched and must have a GL Customer assigned before finalisation.`,
        );
      }

      const foreignAmt = parseFloat(line.amount);
      const baseAmt = foreignAmt * invoiceRate;
      lineTotalForeign += foreignAmt;

      // Extract CC/Activity from product
      const productDims = {
        accountId: productExpenseAccountId || null,
        costCenterId: productCostCenterId || null,
        activityId: productActivityId || null,
      };

      const acctId = line.glAccountId;
      if (acctId) {
        // Line has specific account
        const key = `${acctId}|${productDims.costCenterId || ''}|${productDims.activityId || ''}`;
        const current = expenseGroups.get(key);
        if (current) {
          current.foreignAmount += foreignAmt;
          current.baseAmount += baseAmt;
        } else {
          expenseGroups.set(key, {
            foreignAmount: foreignAmt,
            baseAmount: baseAmt,
            accountId: acctId,
            costCenterId: productDims.costCenterId,
            activityId: productDims.activityId,
          });
        }
      } else if (line.matchStatus === MATCH_STATUS.MATCHED && poProductId) {
        const rc = receiptCosts.get(line.invoiceLineId) || {
          cost: 0,
          poRate: 1,
        };
        const receiptCostBase = rc.cost;
        const poRate = rc.poRate;

        const foreignCost = receiptCostBase / poRate;
        const tradeVarianceBase = baseAmt - foreignCost * invoiceRate;
        const fxVarianceBase = foreignCost * invoiceRate - receiptCostBase;

        // GRNI Clearance
        const key = `GRNI|${productDims.costCenterId || ''}|${productDims.activityId || ''}`;
        const current = grniGroups.get(key);
        if (current) {
          current.baseAmount += receiptCostBase;
          current.foreignAmount += foreignCost;
        } else {
          grniGroups.set(key, {
            baseAmount: receiptCostBase,
            foreignAmount: foreignCost,
            costCenterId: productDims.costCenterId,
            activityId: productDims.activityId,
          });
        }

        // PPV (Trade Variance)
        if (Math.abs(tradeVarianceBase) > 0.005) {
          const ppvKey = `PPV|${productDims.costCenterId || ''}|${productDims.activityId || ''}`;
          const ppvCurrent = ppvGroups.get(ppvKey);
          if (ppvCurrent) {
            ppvCurrent.baseAmount += tradeVarianceBase;
          } else {
            ppvGroups.set(ppvKey, {
              baseAmount: tradeVarianceBase,
              costCenterId: productDims.costCenterId,
              activityId: productDims.activityId,
            });
          }
        }

        // FX Variance
        if (Math.abs(fxVarianceBase) > 0.005) {
          const fxKey = `FX|${productDims.costCenterId || ''}|${productDims.activityId || ''}`;
          const fxCurrent = fxVarianceGroups.get(fxKey);
          if (fxCurrent) {
            fxCurrent.baseAmount += fxVarianceBase;
          } else {
            fxVarianceGroups.set(fxKey, {
              baseAmount: fxVarianceBase,
              costCenterId: productDims.costCenterId,
              activityId: productDims.activityId,
            });
          }
        }
      } else {
        // Default Expense
        const key = `DEF|${productDims.costCenterId || ''}|${productDims.activityId || ''}`;
        const current = defaultExpenseGroups.get(key);
        if (current) {
          current.foreignAmount += foreignAmt;
          current.baseAmount += baseAmt;
        } else {
          defaultExpenseGroups.set(key, {
            foreignAmount: foreignAmt,
            baseAmount: baseAmt,
            costCenterId: productDims.costCenterId,
            activityId: productDims.activityId,
          });
        }
      }
    }

    const headerTotalForeign = parseFloat(invoice.totalAmount || '0');
    const taxAmountForeign = parseFloat(invoice.taxAmount || '0');
    const taxAmountBase = taxAmountForeign * invoiceRate;
    const expectedHeaderForeign = lineTotalForeign + taxAmountForeign;

    if (Math.abs(headerTotalForeign - expectedHeaderForeign) > 0.01) {
      throw new BadRequestException(
        `Invoice totals mismatch. Header: ${headerTotalForeign.toFixed(2)}, Lines+Tax: ${expectedHeaderForeign.toFixed(2)}`,
      );
    }

    // Verify Vendor default AP / Expense Customers + Dimensions
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
      const settings = await this.glService.getSettings(tx);
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
        if (settings?.defaultPpvAccountId)
          distinctAccountIds.add(settings.defaultPpvAccountId);
        if (settings?.realisedFxGainAccountId)
          distinctAccountIds.add(settings.realisedFxGainAccountId);
        if (settings?.realisedFxLossAccountId)
          distinctAccountIds.add(settings.realisedFxLossAccountId);
        if (supplierExpenseAccountId)
          distinctAccountIds.add(supplierExpenseAccountId);
        for (const group of expenseGroups.values())
          distinctAccountIds.add(group.accountId);

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

          const strategy = getAccountingStrategy(
            this.appConfig.inventoryAccountingMode(),
            {} as InventoryGlAccounts,
          );

          const grniCode = strategy.resolvePurchaseClearingAccount(
            settings.defaultGrniAccountId
              ? idToCode.get(settings.defaultGrniAccountId)
              : null,
            fallbackExpCode,
          );

          const taxCode = settings.defaultTaxAccountId
            ? idToCode.get(settings.defaultTaxAccountId)
            : null;

          const ppvCode = settings?.defaultPpvAccountId
            ? idToCode.get(settings.defaultPpvAccountId)
            : null;

          const fxGainCode = settings?.realisedFxGainAccountId
            ? idToCode.get(settings.realisedFxGainAccountId)
            : null;
          const fxLossCode = settings?.realisedFxLossAccountId
            ? idToCode.get(settings.realisedFxLossAccountId)
            : null;

          if (apCode) {
            const glLines: Parameters<GlService['postJournalEntry']>[0] = [];

            const sysDefaultCC = this.appConfig.defaultCostCenterId();
            const sysDefaultAct = this.appConfig.defaultActivityId();
            const supplierDims = {
              costCenterId: supplierCostCenterId,
              activityId: supplierActivityId,
            };
            const isSuppFirst =
              this.appConfig.expenseRoutingPrecedence() === 'supplier_first';

            for (const group of defaultExpenseGroups.values()) {
              if (group.baseAmount > 0 && fallbackExpCode) {
                const prodDims = {
                  costCenterId: group.costCenterId,
                  activityId: group.activityId,
                };
                const dims = resolveGlDimensions(
                  isSuppFirst ? supplierDims : prodDims,
                  isSuppFirst ? prodDims : supplierDims,
                  {
                    defaultCostCenterId: sysDefaultCC,
                    defaultActivityId: sysDefaultAct,
                  },
                );
                glLines.push({
                  accountCode: fallbackExpCode,
                  debit: group.baseAmount,
                  credit: 0,
                  foreignDebit: group.foreignAmount,
                  foreignCredit: 0,
                  foreignCurrencyCode: invoice.currencyCode,
                  exchangeRate: invoiceRate,
                  memo: `Expense (Default): ${invoice.invoiceNumber}`,
                  costCenterId: dims.costCenterId || undefined,
                  activityId: dims.activityId || undefined,
                });
              }
            }

            for (const group of grniGroups.values()) {
              if (group.baseAmount > 0 && grniCode) {
                const prodDims = {
                  costCenterId: group.costCenterId,
                  activityId: group.activityId,
                };
                const dims = resolveGlDimensions(
                  isSuppFirst ? supplierDims : prodDims,
                  isSuppFirst ? prodDims : supplierDims,
                  {
                    defaultCostCenterId: sysDefaultCC,
                    defaultActivityId: sysDefaultAct,
                  },
                );
                glLines.push({
                  accountCode: grniCode,
                  debit: group.baseAmount,
                  credit: 0,
                  foreignDebit: group.foreignAmount,
                  foreignCredit: 0,
                  foreignCurrencyCode: invoice.currencyCode,
                  exchangeRate: invoiceRate, // Approx for reporting
                  memo: `GRNI Clearance: ${invoice.invoiceNumber}`,
                  partyId: invoice.vendorId,
                  partyType: 'supplier',
                  costCenterId: dims.costCenterId || undefined,
                  activityId: dims.activityId || undefined,
                });
              }
            }

            for (const group of ppvGroups.values()) {
              if (Math.abs(group.baseAmount) > 0.005 && ppvCode) {
                const prodDims = {
                  costCenterId: group.costCenterId,
                  activityId: group.activityId,
                };
                const dims = resolveGlDimensions(
                  isSuppFirst ? supplierDims : prodDims,
                  isSuppFirst ? prodDims : supplierDims,
                  {
                    defaultCostCenterId: sysDefaultCC,
                    defaultActivityId: sysDefaultAct,
                  },
                );
                glLines.push({
                  accountCode: ppvCode,
                  debit: group.baseAmount > 0 ? group.baseAmount : 0,
                  credit: group.baseAmount < 0 ? Math.abs(group.baseAmount) : 0,
                  foreignDebit: 0,
                  foreignCredit: 0,
                  foreignCurrencyCode: invoice.currencyCode,
                  exchangeRate: 1,
                  memo: `Purchase Price Variance: ${invoice.invoiceNumber}`,
                  costCenterId: dims.costCenterId || undefined,
                  activityId: dims.activityId || undefined,
                });
              }
            }

            for (const group of fxVarianceGroups.values()) {
              if (Math.abs(group.baseAmount) > 0.005) {
                const isGain = group.baseAmount < 0; // Credit = Gain
                const targetCode = isGain ? fxGainCode : fxLossCode;
                if (!targetCode) {
                  throw new BadRequestException(
                    'Realised FX Gain/Loss accounts are not configured in GL Settings.',
                  );
                }
                const prodDims = {
                  costCenterId: group.costCenterId,
                  activityId: group.activityId,
                };
                const dims = resolveGlDimensions(
                  isSuppFirst ? supplierDims : prodDims,
                  isSuppFirst ? prodDims : supplierDims,
                  {
                    defaultCostCenterId: sysDefaultCC,
                    defaultActivityId: sysDefaultAct,
                  },
                );
                glLines.push({
                  accountCode: targetCode,
                  debit: !isGain ? group.baseAmount : 0,
                  credit: isGain ? Math.abs(group.baseAmount) : 0,
                  foreignDebit: 0,
                  foreignCredit: 0,
                  foreignCurrencyCode: invoice.currencyCode,
                  exchangeRate: 1,
                  memo: `Realised FX Variance (GRNI): ${invoice.invoiceNumber}`,
                  costCenterId: dims.costCenterId || undefined,
                  activityId: dims.activityId || undefined,
                });
              }
            }

            for (const group of expenseGroups.values()) {
              const code = idToCode.get(group.accountId);
              if (code && group.baseAmount > 0) {
                const prodDims = {
                  costCenterId: group.costCenterId,
                  activityId: group.activityId,
                  accountId: group.accountId,
                };
                const suppDims = {
                  costCenterId: supplierCostCenterId,
                  activityId: supplierActivityId,
                  accountId: supplierExpenseAccountId,
                };
                const dims = resolveGlDimensions(
                  isSuppFirst ? suppDims : prodDims,
                  isSuppFirst ? prodDims : suppDims,
                  {
                    defaultCostCenterId: sysDefaultCC,
                    defaultActivityId: sysDefaultAct,
                    defaultAccountId: settings.defaultExpenseAccountId,
                  },
                );
                glLines.push({
                  accountCode: code,
                  debit: group.baseAmount,
                  credit: 0,
                  foreignDebit: group.foreignAmount,
                  foreignCredit: 0,
                  foreignCurrencyCode: invoice.currencyCode,
                  exchangeRate: invoiceRate,
                  memo: `Expense: ${invoice.invoiceNumber}`,
                  costCenterId: dims.costCenterId || undefined,
                  activityId: dims.activityId || undefined,
                });
              }
            }

            if (taxCode && taxAmountBase > 0) {
              glLines.push({
                accountCode: taxCode,
                debit: taxAmountBase,
                credit: 0,
                foreignDebit: taxAmountForeign,
                foreignCredit: 0,
                foreignCurrencyCode: invoice.currencyCode,
                exchangeRate: invoiceRate,
                memo: `Tax: ${invoice.invoiceNumber}`,
              });
            }

            // AP Credit
            const apDims = resolveGlDimensions(supplierDims, supplierDims, {
              defaultCostCenterId: sysDefaultCC,
              defaultActivityId: sysDefaultAct,
            });

            // Rebalance AP Base vs Debits
            const totalDebits = glLines.reduce(
              (sum, l) => sum + Number(l.debit || 0),
              0,
            );
            const totalCreditsExclAp = glLines.reduce(
              (sum, l) => sum + Number(l.credit || 0),
              0,
            );
            const apBaseCredit = totalDebits - totalCreditsExclAp;

            glLines.push({
              accountCode: apCode,
              debit: 0,
              credit: apBaseCredit,
              foreignDebit: 0,
              foreignCredit: headerTotalForeign,
              foreignCurrencyCode: invoice.currencyCode,
              exchangeRate: invoiceRate,
              memo: `Customers Payable: ${invoice.invoiceNumber}`,
              partyId: invoice.vendorId,
              partyType: 'supplier',
              costCenterId: apDims.costCenterId || undefined,
              activityId: apDims.activityId || undefined,
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
        (
          (invoice as unknown as { lines?: { purchaseOrderId?: string }[] })
            .lines || []
        )
          .map((l) => l.purchaseOrderId)
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- We use any[] for lines here due to union complexity, but it's isolated
    const invoice = fullInvoice as typeof fullInvoice & { lines: any[] };

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
      const discrepancies: { type: string; message: string }[] = [];
      invoice.lines.forEach((line, idx: number) => {
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
          entityType: 'purchase_invoice',
          entityId: invoiceId,
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

    const result = await this.changePurchaseInvoiceStateInternal(
      invoiceId,
      newState,
      actor,
      db,
    );

    await emitEvent(db, {
      entityType: EntityType.PURCHASE_INVOICE,
      entityId: invoiceId,
      eventType: EventType.STATUS_CHANGED,
      entityDisplayName: invoice?.invoiceNumber || invoiceId,
      payload: { action: 'changeState', newState },
      actor,
    });

    return result;
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

      const [order] = await tx
        .select({ orderNumber: purchaseOrders.orderNumber })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.purchaseOrderId, poLine.purchaseOrderId));
      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: poLine.purchaseOrderId,
        eventType: EventType.INVOICE_MATCHED,
        entityDisplayName: order.orderNumber,
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
        const [order] = await tx
          .select({ orderNumber: purchaseOrders.orderNumber })
          .from(purchaseOrders)
          .where(eq(purchaseOrders.purchaseOrderId, purchaseOrderId));
        await emitEvent(tx, {
          entityType: EntityType.PURCHASE_ORDER,
          entityId: purchaseOrderId,
          eventType: EventType.INVOICE_MATCHED,
          entityDisplayName: order.orderNumber,
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
        const [order] = await tx
          .select({ orderNumber: purchaseOrders.orderNumber })
          .from(purchaseOrders)
          .where(eq(purchaseOrders.purchaseOrderId, poId));
        await emitEvent(tx, {
          entityType: EntityType.PURCHASE_ORDER,
          entityId: poId,
          eventType: EventType.INVOICE_UNMATCHED,
          entityDisplayName: order.orderNumber,
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
   * Useful for the "All Invoices" page and Customer Detail tabs.
   */
  async findActiveInvoices(query: {
    days?: number;
    vendorId?: string;
    invoiceId?: string;
    balanceStatus?: string;
    limit?: number;
    cursor?: unknown;
    direction?: 'next' | 'prev';
    searchTerm?: string | null;
  }) {
    const {
      days = 30,
      vendorId,
      invoiceId,
      balanceStatus,
      limit = 100,
      cursor,
      direction = 'next',
      searchTerm,
    } = query;

    const conditions: import('drizzle-orm').SQL[] = [];

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
        ) as import('drizzle-orm').SQL,
      );
    }

    if (balanceStatus === 'unpaid') {
      conditions.push(sql`${purchaseInvoices.outstandingAmount}::numeric > 0`);
    } else if (balanceStatus === 'paid') {
      conditions.push(sql`${purchaseInvoices.outstandingAmount}::numeric <= 0`);
    }

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${purchaseInvoices.invoiceNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${purchaseInvoices.invoiceNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${purchaseInvoices.supplierInvoiceNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${purchaseInvoices.supplierInvoiceNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${suppliers.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${suppliers.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    if (searchTerm) {
      conditions.push(
        or(
          ilike(purchaseInvoices.invoiceNumber, `%${rawSearchTerm}%`),
          ilike(purchaseInvoices.supplierInvoiceNumber, `%${rawSearchTerm}%`),
          ilike(suppliers.name, `%${rawSearchTerm}%`),
        ) as import('drizzle-orm').SQL,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let dataQuery = this.db
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
        earlyPaymentDiscount: purchaseInvoices.earlyPaymentDiscount,
        earlyPaymentDiscountDays: purchaseInvoices.earlyPaymentDiscountDays,
        score: scoreSql,
      })
      .from(purchaseInvoices)
      .leftJoin(suppliers, eq(purchaseInvoices.vendorId, suppliers.vendorId))
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
            op(purchaseInvoices.createdOn, new Date(c.createdOn)),
          ),
          and(
            eq(scoreSql, c.score),
            eq(purchaseInvoices.createdOn, new Date(c.createdOn)),
            op(purchaseInvoices.invoiceId, c.invoiceId),
          ),
        ) as import('drizzle-orm').SQL;
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const op = dir === 'next' ? desc : asc;
        return q.orderBy(
          op(scoreSql),
          op(purchaseInvoices.createdOn),
          op(purchaseInvoices.invoiceId),
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

  // @herobm-skip-audit
  private async changePurchaseInvoiceStateInternal(
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
          stateCode: purchaseInvoices.stateCode,
          invoiceNumber: purchaseInvoices.invoiceNumber,
        })
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.invoiceId, invoiceId))
        .for('update')
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

      // If transitioning to CANCELLED, we must reverse the associated GL entries synchronously
      if (newState === PURCHASE_INVOICE_STATE.CANCELLED) {
        const [originalEntry] = await db
          .select()
          .from(glJournalEntries)
          .where(
            and(
              eq(glJournalEntries.sourceType, 'purchase_invoice'),
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

          const reversedLines = originalLines.map((line) => ({
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
            reversedLines as Parameters<GlService['postJournalEntry']>[0],
            {
              sourceId: invoiceId,
              sourceType: 'purchase_invoice_reversal',
              memo: `Reversal of Purchase Invoice ${existing.invoiceNumber}`,
              entryDate: new Date().toISOString().slice(0, 10),
              actor,
            },
            db,
          );
        }
      }

      const [updated] = await db
        .update(purchaseInvoices)
        .set({
          // eslint-disable-next-line no-restricted-syntax -- Dynamic state transition from state machine logic
          stateCode: newState as typeof purchaseInvoices.$inferInsert.stateCode,
          modifiedOn: new Date(),
        })
        .where(eq(purchaseInvoices.invoiceId, invoiceId))
        .returning();

      await emitEvent(db, {
        entityType: EntityType.PURCHASE_INVOICE,
        entityId: invoiceId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: existing.invoiceNumber,
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
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.invoiceId, invoiceId))
        .limit(1);

      if (!invoice) {
        throw new NotFoundException(`Invoice ${invoiceId} not found`);
      }

      if (
        invoice.stateCode === PURCHASE_INVOICE_STATE.PAID ||
        invoice.stateCode === PURCHASE_INVOICE_STATE.CANCELLED
      ) {
        throw new BadRequestException(
          'Cannot mark paid a cancelled or already paid invoice.',
        );
      }

      const [updated] = await tx
        .update(purchaseInvoices)
        .set({
          // eslint-disable-next-line no-restricted-syntax -- Administrative override to bypass standard state machine logic
          stateCode: PURCHASE_INVOICE_STATE.PAID,
          outstandingAmount: '0',
          baseOutstandingAmount: '0',
          modifiedOn: new Date(),
        })
        .where(eq(purchaseInvoices.invoiceId, invoiceId))
        .returning();

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.PURCHASE_INVOICE,
        entityId: invoiceId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: invoice.invoiceNumber,
        payload: {
          entity: 'purchase_invoice',
          entityId: invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          from: invoice.stateCode,
          to: PURCHASE_INVOICE_STATE.PAID,
          note: 'Administrative override: Invoice manually marked as paid without GL impact',
        },
        actor,
      });

      return updated;
    });
  }
}

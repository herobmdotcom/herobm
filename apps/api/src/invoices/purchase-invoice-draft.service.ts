import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseInvoices,
  purchaseInvoiceLines,
  suppliers,
  supplierGroups,
  glAccounts,
  systemEvents,
  tradingTerms,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { AppConfigService } from '../settings/app-config.service';

import { getExchangeRateForCurrency } from '../common/fx-helper';
import {
  computeLinePriceForStorage,
  PURCHASE_INVOICE_STATE,
  PURCHASE_INVOICE_TRANSITIONS,
  MATCH_STATUS,
} from '@herobm/shared';
import { calculateDueDate } from '../settings/trading-terms.utils';
import { resolveEffectiveEarlyPaymentDiscount } from '../customers/credit-control.utils';
import { CreateStandaloneInvoiceDto } from './dto';
import { PurchaseInvoiceCoreService } from './purchase-invoice-core.service';
import { PurchaseInvoicePostingService } from './purchase-invoice-posting.service';

@Injectable()
export class PurchaseInvoiceDraftService {
  private readonly logger = new Logger(PurchaseInvoiceDraftService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
    private readonly taxService: TaxCategoriesService,
    private readonly appConfig: AppConfigService,
    private readonly core: PurchaseInvoiceCoreService,
    @Inject(forwardRef(() => PurchaseInvoicePostingService))
    private readonly postingService: PurchaseInvoicePostingService,
  ) {}

  /**
   * Creates a standalone draft Purchase Invoice.
   */
  async createDraftInvoice(
    dto: CreateStandaloneInvoiceDto,
    actor: string,
    outerTx?: DrizzleDB,
  ): Promise<typeof purchaseInvoices.$inferSelect> {
    const queryDb = outerTx ?? this.db;
    const internalBillNumber = await this.core.generateBillNumber();

    let vendorTermType: string | null = null;
    let vendorTermDays: number | null = null;
    let earlyPaymentDiscount: string | null = null;
    let earlyPaymentDiscountDays: number | null = null;

    if (dto.vendorId) {
      const vendRows = await queryDb
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
            customerGroup: {
              earlyPaymentDiscount:
                vendRows[0].groupEarlyPaymentDiscount ?? null,
              earlyPaymentDiscountDays:
                vendRows[0].groupEarlyPaymentDiscountDays ?? null,
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
          const [term] = await queryDb
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

    const executeCreate = async (tx: DrizzleDB) => {
      const invoiceDate = dto.invoiceDate
        ? new Date(dto.invoiceDate)
        : new Date();
      let dueDate = new Date();
      if (vendorTermType && vendorTermDays !== null) {
        dueDate = calculateDueDate(invoiceDate, vendorTermType, vendorTermDays);
      }

      const piCurrencyCode = dto.currencyCode || this.appConfig.homeCurrency();
      const fx = await getExchangeRateForCurrency(
        tx,
        piCurrencyCode,
        invoiceDate || new Date(),
      );

      const baseTotalAmount = new Decimal(dto.totalAmount)
        .mul(fx.rate)
        .toFixed(2);

      const [invoice] = await tx
        .insert(purchaseInvoices)
        .values({
          invoiceId: randomUUID(),
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
          const qty = new Decimal(l.quantityInvoiced || '0').toNumber();
          const price = new Decimal(l.pricePerUnit || '0').toNumber();
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
    };

    return outerTx
      ? await executeCreate(outerTx)
      : await this.db.transaction(executeCreate);
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
    outerTx?: DrizzleDB,
  ) {
    const executeUpdate = async (tx: DrizzleDB) => {
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
          await this.core.recalculateInvoiceTotals(invoiceId, tx);
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

      return this.core.findOne(invoiceId, tx);
    };

    return outerTx
      ? await executeUpdate(outerTx)
      : await this.db.transaction(executeUpdate);
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
    outerTx?: DrizzleDB,
  ) {
    const executeUpdateLine = async (tx: DrizzleDB) => {
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

      let qty = new Decimal(line.quantityInvoiced).toNumber();
      let price = new Decimal(line.pricePerUnit).toNumber();

      if (dto.quantityInvoiced !== undefined) {
        updateData.quantityInvoiced = String(dto.quantityInvoiced);
        qty = new Decimal(dto.quantityInvoiced).toNumber();
      }
      if (dto.pricePerUnit !== undefined) {
        updateData.pricePerUnit = String(dto.pricePerUnit);
        price = new Decimal(dto.pricePerUnit).toNumber();
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
        await this.core.recalculateInvoiceTotals(invoiceId, tx);
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
    };

    return outerTx
      ? await executeUpdateLine(outerTx)
      : await this.db.transaction(executeUpdateLine);
  }

  async removeLine(
    invoiceId: string,
    lineId: string,
    actor: string,
    outerTx?: DrizzleDB,
  ) {
    const executeRemoveLine = async (tx: DrizzleDB) => {
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

      await this.core.recalculateInvoiceTotals(invoiceId, tx);

      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_INVOICE,
        entityId: invoiceId,
        eventType: EventType.LINE_REMOVED,
        entityDisplayName: invoice.invoiceNumber,
        payload: { action: 'removeLine', lineId },
        actor,
      });

      return { success: true };
    };

    return outerTx
      ? await executeRemoveLine(outerTx)
      : await this.db.transaction(executeRemoveLine);
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
    outerTx?: DrizzleDB,
  ) {
    const executeAddLine = async (tx: DrizzleDB) => {
      const [invoice] = await tx
        .select()
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.invoiceId, invoiceId));
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.stateCode !== PURCHASE_INVOICE_STATE.DRAFT)
        throw new BadRequestException('Only draft invoice lines can be added');

      const qty = new Decimal(dto.quantityInvoiced || '1').toNumber();
      const price = new Decimal(dto.pricePerUnit || '0').toNumber();
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

      await this.core.recalculateInvoiceTotals(invoiceId, tx);

      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_INVOICE,
        entityId: invoiceId,
        eventType: EventType.LINE_ADDED,
        entityDisplayName: invoice.invoiceNumber,
        payload: { action: 'addLine' },
        actor,
      });

      return { success: true };
    };

    return outerTx
      ? await executeAddLine(outerTx)
      : await this.db.transaction(executeAddLine);
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
    const fullInvoice = await this.core.findOne(invoiceId, tx);
    if (!fullInvoice) throw new NotFoundException('Invoice not found');
    const invoice = fullInvoice;

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
          new Decimal(line.amount || '0').gt(0)
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
          const billedQtyDec = new Decimal(line.quantityInvoiced || '0');
          const poReceivedDec = new Decimal(line.poLineQuantityReceived || '0');
          const billedPriceDec = new Decimal(line.pricePerUnit || '0');
          const poPriceDec = new Decimal(line.poLinePricePerUnit || '0');

          if (billedPriceDec.minus(poPriceDec).abs().gt(0.001)) {
            discrepancies.push({
              type: 'price_variance',
              message: `Line ${idx + 1} price variance.`,
            });
          }
          if (billedQtyDec.gt(poReceivedDec)) {
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
      return this.postingService.postInvoice(invoiceId, actor);
    }

    const result = await this.core.changePurchaseInvoiceStateInternal(
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

  async adminMarkPaid(invoiceId: string, actor: string, outerTx?: DrizzleDB) {
    const executeMarkPaid = async (tx: DrizzleDB) => {
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
    };

    return outerTx
      ? await executeMarkPaid(outerTx)
      : await this.db.transaction(executeMarkPaid);
  }
}

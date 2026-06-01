import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql, desc, and } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesCreditNotes,
  salesCreditNoteLines,
  salesOrderReturns,
  salesOrderReturnLines,
  salesOrderLineItems,
  salesOrders,
  salesInvoices,
  glAccounts,
  customers as coreAccounts,
  customerGroups,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { AppConfigService } from '../settings/app-config.service';
import { EnrichmentService } from '../enrichment/enrichment.service';
import { computeLinePrice, computeReturnCreditSummary } from '@modbm/shared';
import {
  SALES_CREDIT_NOTE_STATE,
  SALES_CREDIT_NOTE_TRANSITIONS,
  getValidStates,
} from '@modbm/shared';

const VALID_CN_STATES = getValidStates(SALES_CREDIT_NOTE_TRANSITIONS);

@Injectable()
export class SalesCreditNoteService {
  private readonly logger = new Logger(SalesCreditNoteService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
    private readonly taxService: TaxCategoriesService,
    private readonly appConfig: AppConfigService,
    private readonly enrichmentService: EnrichmentService,
  ) {}

  /**
   * Generate a human-readable credit note number (CN-YYYYMMDD-NNNN).
   */
  private async generateCreditNoteNumber(tx?: DrizzleDB): Promise<string> {
    const db = tx || this.db;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `CN-${today}-`;
    const result = await db
      .select({ creditNoteNumber: salesCreditNotes.creditNoteNumber })
      .from(salesCreditNotes)
      .where(sql`${salesCreditNotes.creditNoteNumber} LIKE ${prefix + '%'}`)
      .orderBy(sql`${salesCreditNotes.creditNoteNumber} DESC`)
      .limit(1);
    const seq =
      result.length > 0
        ? parseInt(result[0].creditNoteNumber.replace(prefix, ''), 10) + 1
        : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /**
   * Create a credit note from a processed return.
   * Posts the Revenue/AR/Tax GL reversal and creates the credit note document.
   */
  async createCreditNote(returnId: string, actor: string, tx?: DrizzleDB) {
    const queryDb = tx || this.db;

    return await queryDb.transaction(async (innerTx: DrizzleDB) => {
      // 1. Load the return + order context
      const [ret] = await innerTx
        .select()
        .from(salesOrderReturns)
        .where(eq(salesOrderReturns.returnId, returnId))
        .limit(1);
      if (!ret) {
        throw new NotFoundException(`Return '${returnId}' not found`);
      }

      const [order] = await innerTx
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, ret.salesOrderId))
        .limit(1);
      if (!order) {
        throw new NotFoundException(`Order '${ret.salesOrderId}' not found`);
      }

      // 2. Resolve GL settings
      const settings = await this.glService.getSettings(innerTx);
      if (!settings?.defaultArAccountId || !settings?.defaultRevenueAccountId) {
        this.logger.warn(
          'GL settings incomplete — skipping credit note GL posting',
        );
        return null;
      }

      // Resolve customer codes from settings IDs
      const settingsIds = [
        settings.defaultArAccountId,
        settings.defaultRevenueAccountId,
        settings.defaultTaxAccountId,
        settings.defaultFeeRevenueAccountId,
      ].filter((id): id is string => !!id);

      const acctRows = await innerTx
        .select({
          glAccountId: glAccounts.glAccountId,
          accountCode: glAccounts.accountCode,
        })
        .from(glAccounts)
        .where(
          sql`${glAccounts.glAccountId} IN (${sql.join(
            settingsIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );

      const idToCode = new Map(
        acctRows.map((a) => [a.glAccountId, a.accountCode]),
      );
      const arCode = idToCode.get(settings.defaultArAccountId);
      const revCode = settings.defaultRevenueAccountId
        ? idToCode.get(settings.defaultRevenueAccountId)
        : null;
      const taxCode = settings.defaultTaxAccountId
        ? idToCode.get(settings.defaultTaxAccountId)
        : null;
      const feeCode = settings.defaultFeeRevenueAccountId
        ? idToCode.get(settings.defaultFeeRevenueAccountId)
        : null;

      if (!arCode || !revCode) {
        this.logger.warn(
          'AR or Revenue customer code not found — skipping credit note GL',
        );
        return null;
      }

      // 3. Resolve customer cost center / activity dimensions
      let customerCostCenterId: string | undefined;
      let customerActivityId: string | undefined;

      if (order.customerId) {
        const [custInfo] = await innerTx
          .select({
            costCenterId: customerGroups.defaultCostCenterId,
            activityId: customerGroups.defaultActivityId,
          })
          .from(coreAccounts)
          .leftJoin(
            customerGroups,
            eq(coreAccounts.customerGroupId, customerGroups.customerGroupId),
          )
          .where(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              order.customerId,
            )
              ? eq(coreAccounts.customerId, order.customerId)
              : eq(coreAccounts.externalId, order.customerId),
          );

        if (custInfo) {
          customerCostCenterId = custInfo.costCenterId || undefined;
          customerActivityId = custInfo.activityId || undefined;
        }
      }

      // 4. Fetch return lines + join to order lines for pricing + tax
      const returnLines = await innerTx
        .select()
        .from(salesOrderReturnLines)
        .where(eq(salesOrderReturnLines.returnId, returnId));

      let totalCreditAmount = 0;
      let totalTaxAmount = 0;
      let totalFees = 0;
      const cnLineValues: Array<{
        salesOrderLineId: string;
        quantityCredited: string;
        pricePerUnit: string;
        amount: string;
        taxAmount: string;
      }> = [];
      const creditLineInputs: Array<{
        quantity: number;
        pricePerUnit: number;
        discountPercentage: number;
        taxRate: number;
        returnFee: number;
      }> = [];

      for (const rl of returnLines) {
        const orderLine = await innerTx
          .select()
          .from(salesOrderLineItems)
          .where(eq(salesOrderLineItems.salesOrderLineId, rl.salesOrderLineId))
          .limit(1)
          .then((r: any[]) => r[0]);

        if (!orderLine) continue;

        const unitPrice = parseFloat(orderLine.pricePerUnit || '0');
        const disc = parseFloat(orderLine.discountPercentage || '0');
        const qty = parseFloat(rl.quantityReturned || '0');
        const fee = parseFloat(rl.returnFee || '0');

        // Resolve per-line tax rate
        let taxRate = 0;
        if (orderLine.taxCategoryId) {
          try {
            const cat = await this.taxService.getById(orderLine.taxCategoryId);
            taxRate = parseFloat(cat.rate ?? '0');
          } catch {
            // Category not found — fall back to 0%
          }
        }

        const pricing = computeLinePrice({
          quantity: qty,
          pricePerUnit: unitPrice,
          discountPercentage: disc,
          taxRate,
        });

        cnLineValues.push({
          salesOrderLineId: rl.salesOrderLineId,
          quantityCredited: rl.quantityReturned,
          pricePerUnit: orderLine.pricePerUnit || '0',
          amount: pricing.amount.toFixed(2),
          taxAmount: pricing.tax.toFixed(2),
        });

        creditLineInputs.push({
          quantity: qty,
          pricePerUnit: unitPrice,
          discountPercentage: disc,
          taxRate,
          returnFee: fee,
        });
      }

      // Centralised totals calculation
      const creditSummary = computeReturnCreditSummary(creditLineInputs);
      totalCreditAmount = creditSummary.subtotal;
      totalTaxAmount = creditSummary.totalTax;
      totalFees = creditSummary.totalFees;

      if (totalCreditAmount <= 0) {
        this.logger.warn('No credit amount to post — skipping credit note');
        return null;
      }

      // Net AR credit = credit amount + tax - fees
      const netArCredit = creditSummary.netCredit;

      // 5. Find the most recent posted invoice for this order (if any)
      const [latestInvoice] = await innerTx
        .select({ invoiceId: salesInvoices.invoiceId })
        .from(salesInvoices)
        .where(eq(salesInvoices.salesOrderId, ret.salesOrderId))
        .orderBy(desc(salesInvoices.createdOn))
        .limit(1);

      // 6. Create the credit note document
      const creditNoteNumber = await this.generateCreditNoteNumber(innerTx);

      const [creditNote] = await innerTx
        .insert(salesCreditNotes)
        .values({
          creditNoteNumber,
          returnId,
          salesOrderId: ret.salesOrderId,
          invoiceId: latestInvoice?.invoiceId ?? null,
          totalAmount: totalCreditAmount.toFixed(2),
          taxAmount: totalTaxAmount.toFixed(2),
          feeAmount: totalFees.toFixed(2),
          outstandingAmount: netArCredit.toFixed(2),
          currencyCode: order.currencyCode,
          stateCode: SALES_CREDIT_NOTE_STATE.POSTED,
          notes: `Credit note for return ${ret.returnNumber}`,
          createdBy: actor,
        })
        .returning();

      // 7. Create credit note lines
      if (cnLineValues.length > 0) {
        await innerTx.insert(salesCreditNoteLines).values(
          cnLineValues.map((line) => ({
            creditNoteId: creditNote.creditNoteId,
            ...line,
          })),
        );
      }

      // 8. Post the GL journal entry (reverse of sales invoice)
      const glLines: any[] = [
        {
          accountCode: revCode,
          debit: totalCreditAmount,
          credit: 0,
          memo: `Sales return: ${ret.returnNumber}`,
          costCenterId: customerCostCenterId,
          activityId: customerActivityId,
        },
        {
          accountCode: arCode,
          debit: 0,
          credit: netArCredit,
          memo: `Credit note: ${creditNoteNumber}`,
          partyType: 'customer',
          partyId: order.customerId,
          costCenterId: customerCostCenterId,
          activityId: customerActivityId,
        },
      ];

      if (taxCode && totalTaxAmount > 0) {
        glLines.push({
          accountCode: taxCode,
          debit: totalTaxAmount,
          credit: 0,
          memo: `GST reversal: ${ret.returnNumber}`,
          costCenterId: customerCostCenterId,
          activityId: customerActivityId,
        });
      }

      if (totalFees > 0 && feeCode) {
        glLines.push({
          accountCode: feeCode,
          debit: 0,
          credit: totalFees,
          memo: `Restocking fee: ${ret.returnNumber}`,
          costCenterId: customerCostCenterId,
          activityId: customerActivityId,
        });
      }

      await this.glService.postJournalEntry(
        glLines,
        {
          sourceType: 'sales_credit_note',
          sourceId: creditNote.creditNoteId,
          memo: `Credit note ${creditNoteNumber} for return ${ret.returnNumber} on order ${order.orderNumber}`,
          actor,
        },
        innerTx,
      );

      // Record Refund in External Engine if applicable
      const orderTaxProvider = (order as any).taxProvider;
      if (
        orderTaxProvider &&
        orderTaxProvider !== 'internal' &&
        !orderTaxProvider.endsWith('-error')
      ) {
        const payload = {
          transaction_id: creditNote.creditNoteId,
          transaction_reference_id:
            latestInvoice?.invoiceId ?? order.salesOrderId,
          transaction_date: new Date().toISOString(),
          amount: totalCreditAmount,
          shipping: 0,
          sales_tax: totalTaxAmount,
        };
        try {
          const enrichRes = await this.enrichmentService.recordRefund(
            orderTaxProvider,
            payload,
          );
          if (!enrichRes.isValid) {
            throw new BadRequestException(
              `Tax provider rejected refund: ${enrichRes.data?.error}`,
            );
          }
          this.logger.log(
            `Refund recorded in ${orderTaxProvider} for credit note ${creditNoteNumber}`,
          );
        } catch (e: any) {
          this.logger.error(
            `Failed to record refund in ${orderTaxProvider}`,
            e,
          );
          throw new BadRequestException(
            `Failed to record refund in ${orderTaxProvider}: ${e.message}`,
          );
        }
      }

      // 9. Outbox event
      await emitEvent(innerTx as any, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: ret.salesOrderId,
        eventType: EventType.CREDIT_NOTE_POSTED,
        payload: {
          creditNoteId: creditNote.creditNoteId,
          creditNoteNumber,
          returnId,
          returnNumber: ret.returnNumber,
          salesOrderId: ret.salesOrderId,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          totalCredit: totalCreditAmount,
          totalTax: totalTaxAmount,
          totalFees,
          netCredit: netArCredit,
          currency: order.currencyCode,
        },
        actor,
      });

      this.logger.log(
        `Credit note ${creditNoteNumber} posted for return ${ret.returnNumber}: credit=${totalCreditAmount}, tax=${totalTaxAmount}, fees=${totalFees}, netAR=${netArCredit}`,
      );

      return creditNote;
    });
  }

  /**
   * Find a single credit note by ID.
   */
  async findOne(creditNoteId: string) {
    const [cn] = await this.db
      .select()
      .from(salesCreditNotes)
      .where(eq(salesCreditNotes.creditNoteId, creditNoteId))
      .limit(1);

    if (!cn) {
      throw new NotFoundException(`Credit note '${creditNoteId}' not found`);
    }

    const lines = await this.db
      .select()
      .from(salesCreditNoteLines)
      .where(eq(salesCreditNoteLines.creditNoteId, creditNoteId));

    return { ...cn, lines };
  }

  /**
   * List credit notes for a specific order.
   */
  async findByOrder(salesOrderId: string) {
    const notes = await this.db
      .select()
      .from(salesCreditNotes)
      .where(eq(salesCreditNotes.salesOrderId, salesOrderId))
      .orderBy(desc(salesCreditNotes.createdOn));

    const result = [];
    for (const cn of notes) {
      const lines = await this.db
        .select()
        .from(salesCreditNoteLines)
        .where(eq(salesCreditNoteLines.creditNoteId, cn.creditNoteId));
      result.push({ ...cn, lines });
    }

    return result;
  }

  /**
   * List credit notes for a specific invoice.
   */
  async findByInvoice(invoiceId: string) {
    return this.db
      .select()
      .from(salesCreditNotes)
      .where(eq(salesCreditNotes.invoiceId, invoiceId))
      .orderBy(desc(salesCreditNotes.createdOn));
  }

  /**
   * Transition credit note state.
   */
  async changeCreditNoteState(
    creditNoteId: string,
    newState: string,
    actor: string,
    tx?: DrizzleDB,
  ) {
    if (!VALID_CN_STATES.includes(newState)) {
      throw new BadRequestException(`Invalid credit note state: '${newState}'`);
    }

    const existing = await this.findOne(creditNoteId);
    const allowed = SALES_CREDIT_NOTE_TRANSITIONS[existing.stateCode];

    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition credit note from '${existing.stateCode}' to '${newState}'. ` +
          `Allowed transitions: ${allowed?.join(', ') || 'none'}`,
      );
    }

    const [updated] = await (tx || this.db)
      .update(salesCreditNotes)
      .set({ stateCode: newState, modifiedOn: new Date() })
      .where(eq(salesCreditNotes.creditNoteId, creditNoteId))
      .returning();

    this.logger.log(
      `Credit note ${existing.creditNoteNumber} state: ${existing.stateCode} → ${newState} by ${actor}`,
    );

    return updated;
  }
}

import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { GlService } from './gl.service';
import {
  RunFxRevaluationDto,
  CommitFxRevaluationDto,
  JournalLineDto,
} from './dto';
import {
  exchangeRates,
  purchaseInvoices,
  salesInvoices,
  salesOrders,
  goodsReceived,
  goodsReceivedLines,
  purchaseOrders,
  customers,
  suppliers,
} from '../drizzle/herobm-core-schema';
import { and, desc, eq, gt, lte, ne } from 'drizzle-orm';
import { MATCH_STATUS } from '@herobm/shared';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';

@Injectable()
export class FxRevaluationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
  ) {}

  async generateCandidates(dto: RunFxRevaluationDto) {
    return await this.db.transaction(async (tx: DrizzleDB) => {
      const settings = await this.glService.getSettings(tx);
      const baseCurrency = settings.baseCurrency;

      const fxGainAccountId = settings.unrealisedFxGainAccountId;
      const fxLossAccountId = settings.unrealisedFxLossAccountId;

      if (!fxGainAccountId || !fxLossAccountId) {
        throw new BadRequestException(
          'Unrealised FX Gain/Loss accounts are not configured in GL Settings.',
        );
      }

      // 1. Fetch exchange rates active on or before revaluationDate
      const activeRates = await tx
        .select()
        .from(exchangeRates)
        .where(lte(exchangeRates.effectiveDate, new Date(dto.revaluationDate)))
        .orderBy(desc(exchangeRates.effectiveDate));

      const ratesByCurrency = new Map<string, number>();
      for (const r of activeRates) {
        if (!ratesByCurrency.has(r.currencyCode)) {
          ratesByCurrency.set(r.currencyCode, parseFloat(r.buyRate));
        }
      }

      const linesReval: JournalLineDto[] = [];
      let totalRevalDebits = 0;
      let totalRevalCredits = 0;

      const addVariance = (
        variance: number, // positive = gain, negative = loss
        controlAccountId: string,
        partyType: 'customer' | 'supplier' | null,
        partyId: string | null,
        currencyCode: string,
        memo: string,
        foreignAmount: number,
        monthEndRate: number,
      ) => {
        if (Math.abs(variance) < 0.005) return; // ignore sub-cent

        let debitControl = 0;
        let creditControl = 0;
        let debitFx = 0;
        let creditFx = 0;

        if (variance > 0) {
          // Gain
          creditFx = variance;
          debitControl = variance;
        } else {
          // Loss
          debitFx = Math.abs(variance);
          creditControl = Math.abs(variance);
        }

        // Revaluation Entry
        linesReval.push({
          accountId: controlAccountId,
          debit: debitControl,
          credit: creditControl,
          foreignDebit: debitControl > 0 ? foreignAmount : 0,
          foreignCredit: creditControl > 0 ? foreignAmount : 0,
          foreignCurrencyCode: currencyCode,
          exchangeRate: monthEndRate,
          partyType,
          partyId,
          memo,
        });

        linesReval.push({
          accountId: variance > 0 ? fxGainAccountId : fxLossAccountId,
          debit: debitFx,
          credit: creditFx,
          partyType,
          partyId,
          memo,
        });

        totalRevalDebits += debitControl + debitFx;
        totalRevalCredits += creditControl + creditFx;
      };

      // 2. Revalue AP (Purchase Invoices)
      const openAP = await tx
        .select({
          invoiceId: purchaseInvoices.invoiceId,
          invoiceNumber: purchaseInvoices.invoiceNumber,
          currencyCode: purchaseInvoices.currencyCode,
          exchangeRate: purchaseInvoices.exchangeRate,
          outstandingAmount: purchaseInvoices.outstandingAmount,
          vendorId: purchaseInvoices.vendorId,
        })
        .from(purchaseInvoices)
        .leftJoin(suppliers, eq(suppliers.vendorId, purchaseInvoices.vendorId))
        .where(
          and(
            gt(purchaseInvoices.outstandingAmount, '0'),
            ne(purchaseInvoices.currencyCode, baseCurrency),
            lte(purchaseInvoices.invoiceDate, new Date(dto.revaluationDate)),
          ),
        );

      for (const inv of openAP) {
        const monthEndRate = ratesByCurrency.get(inv.currencyCode);
        if (!monthEndRate) continue; // skip if no rate available

        const origRate = parseFloat(inv.exchangeRate);
        const outstanding = parseFloat(inv.outstandingAmount);

        // AP is a liability. Loss if rate drops
        const variance = (origRate - monthEndRate) * outstanding;

        const controlAccount = settings.defaultApAccountId;
        if (controlAccount) {
          addVariance(
            variance,
            controlAccount,
            'supplier',
            inv.vendorId,
            inv.currencyCode,
            `Unrealised FX Revaluation - AP Invoice ${inv.invoiceNumber}`,
            outstanding,
            monthEndRate,
          );
        }
      }

      // 3. Revalue AR (Sales Invoices)
      const openAR = await tx
        .select({
          invoiceId: salesInvoices.invoiceId,
          invoiceNumber: salesInvoices.invoiceNumber,
          currencyCode: salesInvoices.currencyCode,
          exchangeRate: salesInvoices.exchangeRate,
          outstandingAmount: salesInvoices.outstandingAmount,
          customerId: salesOrders.customerId,
        })
        .from(salesInvoices)
        .leftJoin(
          salesOrders,
          eq(salesOrders.salesOrderId, salesInvoices.salesOrderId),
        )
        .leftJoin(customers, eq(customers.customerId, salesOrders.customerId))
        .where(
          and(
            gt(salesInvoices.outstandingAmount, '0'),
            ne(salesInvoices.currencyCode, baseCurrency),
            lte(salesInvoices.invoiceDate, new Date(dto.revaluationDate)),
          ),
        );

      for (const inv of openAR) {
        const monthEndRate = ratesByCurrency.get(inv.currencyCode);
        if (!monthEndRate) continue;

        const origRate = parseFloat(inv.exchangeRate);
        const outstanding = parseFloat(inv.outstandingAmount);

        // AR is an asset. Gain if rate rises
        const variance = (monthEndRate - origRate) * outstanding;

        const controlAccount = settings.defaultArAccountId;
        if (controlAccount) {
          addVariance(
            variance,
            controlAccount,
            'customer',
            inv.customerId,
            inv.currencyCode,
            `Unrealised FX Revaluation - AR Invoice ${inv.invoiceNumber}`,
            outstanding,
            monthEndRate,
          );
        }
      }

      // 4. Revalue GRNI (Goods Received Not Invoiced)
      const openGRNI = await tx
        .select({
          goodsReceivedId: goodsReceived.goodsReceivedId,
          receiptNumber: goodsReceived.receiptNumber,
          vendorId: goodsReceived.vendorId,
          currencyCode: purchaseOrders.currencyCode,
          exchangeRate: purchaseOrders.exchangeRate,
          quantityReceived: goodsReceivedLines.quantityReceived,
          unitCost: goodsReceivedLines.unitCost,
        })
        .from(goodsReceivedLines)
        .innerJoin(
          goodsReceived,
          eq(goodsReceived.goodsReceivedId, goodsReceivedLines.goodsReceivedId),
        )
        .innerJoin(
          purchaseOrders,
          eq(
            purchaseOrders.purchaseOrderId,
            goodsReceivedLines.purchaseOrderId,
          ),
        )
        .where(
          and(
            ne(goodsReceivedLines.matchStatus, MATCH_STATUS.MATCHED),
            ne(purchaseOrders.currencyCode, baseCurrency),
            lte(
              goodsReceived.createdOn,
              new Date(dto.revaluationDate + 'T23:59:59Z'),
            ),
          ),
        );

      for (const grni of openGRNI) {
        if (!grni.currencyCode || !grni.exchangeRate || !grni.unitCost)
          continue;

        const monthEndRate = ratesByCurrency.get(grni.currencyCode);
        if (!monthEndRate) continue;

        const origRate = parseFloat(grni.exchangeRate);
        const qty = parseFloat(grni.quantityReceived);
        const unitCost = parseFloat(grni.unitCost);
        const foreignAmount = qty * unitCost;

        // GRNI is a liability.
        const variance = (origRate - monthEndRate) * foreignAmount;

        const controlAccount = settings.defaultGrniAccountId;
        if (controlAccount) {
          addVariance(
            variance,
            controlAccount,
            'supplier',
            grni.vendorId,
            grni.currencyCode,
            `Unrealised FX Revaluation - GRNI ${grni.receiptNumber}`,
            foreignAmount,
            monthEndRate,
          );
        }
      }

      return {
        success: true,
        revaluationDate: dto.revaluationDate,
        candidates: linesReval,
      };
    });
  }

  async commitRevaluation(dto: CommitFxRevaluationDto, actor: string) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('No lines provided to commit.');
    }

    let totalDebits = 0;
    let totalCredits = 0;

    const linesReverse: JournalLineDto[] = [];

    for (const line of dto.lines) {
      totalDebits += line.debit || 0;
      totalCredits += line.credit || 0;

      linesReverse.push({
        ...line,
        debit: line.credit || 0,
        credit: line.debit || 0,
        memo: `Reversal: ${line.memo || 'FX Revaluation'}`,
      });
    }

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new BadRequestException('Journal entry lines do not balance.');
    }

    return await this.db.transaction(async (tx: DrizzleDB) => {
      // Post Revaluation (Dated on revaluationDate)
      await this.glService.postJournalEntry(
        dto.lines,
        {
          sourceType: 'adjustment',
          memo: `Period-End FX Revaluation for ${dto.revaluationDate}`,
          entryDate: dto.revaluationDate,
        },
        tx,
      );

      // Calculate next day for reversal
      const revDate = new Date(dto.revaluationDate);
      revDate.setUTCDate(revDate.getUTCDate() + 1);
      const nextDayStr = revDate.toISOString().split('T')[0];

      // Post Reversal (Dated on revaluationDate + 1)
      await this.glService.postJournalEntry(
        linesReverse,
        {
          sourceType: 'adjustment',
          memo: `Reversal of Period-End FX Revaluation for ${dto.revaluationDate}`,
          entryDate: nextDayStr,
        },
        tx,
      );

      return {
        success: true,
        revaluationDate: dto.revaluationDate,
        entriesGenerated: dto.lines.length * 2, // lines + reversal
      };
    });
  }
}

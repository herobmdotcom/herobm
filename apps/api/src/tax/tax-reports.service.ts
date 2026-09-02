import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  glJournalLines,
  glJournalEntries,
  taxCategories,
} from '@herobm/db-schema';
import { eq, and, gte, lte, sql, inArray } from 'drizzle-orm';
import {
  calculateGenericTaxSummary,
  buildStatutoryReportBoxes,
  getTaxReportMetadata,
  TaxReportType,
} from '@herobm/shared';
import { TaxReportQueryDto, TaxReportResponseDto } from './tax-reports.dto';

@Injectable()
export class TaxReportsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async getTaxReport(query: TaxReportQueryDto): Promise<TaxReportResponseDto> {
    const reportType = (query.reportType || 'generic') as TaxReportType;
    const settings = await this.db.query.glSettings.findFirst();

    if (
      !settings ||
      !settings.defaultSalesTaxAccountId ||
      !settings.defaultPurchaseTaxAccountId ||
      !settings.defaultRevenueAccountId
    ) {
      throw new Error(
        'GL Settings: defaultSalesTaxAccountId, defaultPurchaseTaxAccountId, and defaultRevenueAccountId must be configured.',
      );
    }

    const {
      defaultSalesTaxAccountId,
      defaultPurchaseTaxAccountId,
      defaultRevenueAccountId,
      defaultExpenseAccountId,
    } = settings;

    // Retrieve all active tax categories
    const allTaxCats = await this.db.select().from(taxCategories);
    const salesTaxAccountIds = new Set<string>();
    const purchaseTaxAccountIds = new Set<string>();

    salesTaxAccountIds.add(defaultSalesTaxAccountId);
    purchaseTaxAccountIds.add(defaultPurchaseTaxAccountId);

    for (const cat of allTaxCats) {
      if (cat.salesGlAccountId) salesTaxAccountIds.add(cat.salesGlAccountId);
      if (cat.purchaseGlAccountId)
        purchaseTaxAccountIds.add(cat.purchaseGlAccountId);
    }

    // Build the date filter condition for journal entries
    let dateFilter = undefined;
    if (query.fromDate && query.toDate) {
      dateFilter = and(
        gte(glJournalEntries.entryDate, query.fromDate),
        lte(glJournalEntries.entryDate, query.toDate),
      );
    } else if (query.fromDate) {
      dateFilter = gte(glJournalEntries.entryDate, query.fromDate);
    } else if (query.toDate) {
      dateFilter = lte(glJournalEntries.entryDate, query.toDate);
    }

    // 1. Calculate Sales Tax by Account
    const salesTaxRows = await this.db
      .select({
        glAccountId: glJournalLines.glAccountId,
        totalCredit: sql<string>`COALESCE(SUM(${glJournalLines.credit}), 0)`,
        totalDebit: sql<string>`COALESCE(SUM(${glJournalLines.debit}), 0)`,
      })
      .from(glJournalLines)
      .innerJoin(
        glJournalEntries,
        eq(glJournalLines.journalEntryId, glJournalEntries.journalEntryId),
      )
      .where(
        and(
          inArray(glJournalLines.glAccountId, Array.from(salesTaxAccountIds)),
          eq(glJournalEntries.isReversed, false),
          dateFilter,
        ),
      )
      .groupBy(glJournalLines.glAccountId);

    const salesTaxMap = new Map<string, number>();
    for (const row of salesTaxRows) {
      const netCredit =
        parseFloat(row.totalCredit || '0') - parseFloat(row.totalDebit || '0');
      salesTaxMap.set(row.glAccountId, netCredit);
    }

    // 2. Calculate Purchase Tax by Account
    const purchaseTaxRows = await this.db
      .select({
        glAccountId: glJournalLines.glAccountId,
        totalCredit: sql<string>`COALESCE(SUM(${glJournalLines.credit}), 0)`,
        totalDebit: sql<string>`COALESCE(SUM(${glJournalLines.debit}), 0)`,
      })
      .from(glJournalLines)
      .innerJoin(
        glJournalEntries,
        eq(glJournalLines.journalEntryId, glJournalEntries.journalEntryId),
      )
      .where(
        and(
          inArray(
            glJournalLines.glAccountId,
            Array.from(purchaseTaxAccountIds),
          ),
          eq(glJournalEntries.isReversed, false),
          dateFilter,
        ),
      )
      .groupBy(glJournalLines.glAccountId);

    const purchaseTaxMap = new Map<string, number>();
    for (const row of purchaseTaxRows) {
      const netDebit =
        parseFloat(row.totalDebit || '0') - parseFloat(row.totalCredit || '0');
      purchaseTaxMap.set(row.glAccountId, netDebit);
    }

    // 3. Calculate Revenue / Net Sales
    const revenueAmounts = await this.db
      .select({
        totalCredit: sql<string>`COALESCE(SUM(${glJournalLines.credit}), 0)`,
        totalDebit: sql<string>`COALESCE(SUM(${glJournalLines.debit}), 0)`,
      })
      .from(glJournalLines)
      .innerJoin(
        glJournalEntries,
        eq(glJournalLines.journalEntryId, glJournalEntries.journalEntryId),
      )
      .where(
        and(
          eq(glJournalLines.glAccountId, defaultRevenueAccountId),
          eq(glJournalEntries.isReversed, false),
          dateFilter,
        ),
      );

    const revenueCredit = parseFloat(revenueAmounts[0]?.totalCredit || '0');
    const revenueDebit = parseFloat(revenueAmounts[0]?.totalDebit || '0');
    const totalNetSales = revenueCredit - revenueDebit;

    // 4. Calculate Expenses / Purchases if configured
    let totalNetPurchases = 0;
    if (defaultExpenseAccountId) {
      const expenseAmounts = await this.db
        .select({
          totalCredit: sql<string>`COALESCE(SUM(${glJournalLines.credit}), 0)`,
          totalDebit: sql<string>`COALESCE(SUM(${glJournalLines.debit}), 0)`,
        })
        .from(glJournalLines)
        .innerJoin(
          glJournalEntries,
          eq(glJournalLines.journalEntryId, glJournalEntries.journalEntryId),
        )
        .where(
          and(
            eq(glJournalLines.glAccountId, defaultExpenseAccountId),
            eq(glJournalEntries.isReversed, false),
            dateFilter,
          ),
        );
      const expDebit = parseFloat(expenseAmounts[0]?.totalDebit || '0');
      const expCredit = parseFloat(expenseAmounts[0]?.totalCredit || '0');
      totalNetPurchases = expDebit - expCredit;
    }

    // 5. Delegate mathematical aggregation to shared engine
    const genericSummary = calculateGenericTaxSummary({
      salesTaxByAccount: salesTaxMap,
      purchaseTaxByAccount: purchaseTaxMap,
      totalNetSales,
      totalNetPurchases,
      defaultSalesTaxAccountId,
      categories: allTaxCats,
      currencyCode: 'AUD',
    });

    const { title, subtitle } = getTaxReportMetadata(reportType);
    const boxes = buildStatutoryReportBoxes(reportType, genericSummary);

    return {
      reportType,
      title,
      subtitle,
      genericSummary,
      boxes,
    };
  }
}

import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  glJournalLines,
  glJournalEntries,
  glSettings,
} from '../drizzle/herobm-core-schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { BasSummaryQueryDto, BasSummaryRowDto } from './tax-bas.dto';

@Injectable()
export class TaxBasService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async getBasSummary(query: BasSummaryQueryDto): Promise<BasSummaryRowDto[]> {
    const settings = await this.db.query.glSettings.findFirst();

    if (
      !settings ||
      !settings.defaultTaxAccountId ||
      !settings.defaultRevenueAccountId
    ) {
      throw new Error(
        'GL Settings: defaultTaxAccountId and defaultRevenueAccountId must be configured.',
      );
    }

    const { defaultTaxAccountId, defaultRevenueAccountId } = settings;

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

    // 1. Calculate Tax (1A and 1B)
    const taxAmounts = await this.db
      .select({
        totalCredit: sql<string>`SUM(${glJournalLines.credit})`,
        totalDebit: sql<string>`SUM(${glJournalLines.debit})`,
      })
      .from(glJournalLines)
      .innerJoin(
        glJournalEntries,
        eq(glJournalLines.journalEntryId, glJournalEntries.journalEntryId),
      )
      .where(
        and(
          eq(glJournalLines.glAccountId, defaultTaxAccountId),
          eq(glJournalEntries.isReversed, false),
          dateFilter,
        ),
      );

    const taxCredit = parseFloat(taxAmounts[0]?.totalCredit || '0');
    const taxDebit = parseFloat(taxAmounts[0]?.totalDebit || '0');

    // 1A GST on sales = Credits to Tax Account
    const gstOnSales = Math.round(taxCredit);

    // 1B GST on purchases = Debits to Tax Account
    const gstOnPurchases = Math.round(taxDebit);

    // 2. Calculate Revenue
    const revenueAmounts = await this.db
      .select({
        totalCredit: sql<string>`SUM(${glJournalLines.credit})`,
        totalDebit: sql<string>`SUM(${glJournalLines.debit})`, // in case of refunds
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
    const netRevenue = revenueCredit - revenueDebit;

    // G1 Total sales = Net Revenue (excl GST) + GST on Sales
    // ATO requires G1 to be GST inclusive.
    const totalSales = Math.round(netRevenue + taxCredit);

    // 3. W1 and W2 (Not currently tracked)
    const w1 = 0;
    const w2 = 0;

    // 4. Summaries
    const totalOwedToAto = gstOnSales + w2; // 8A
    const totalOwedByAto = gstOnPurchases; // 8B
    const netAmount = Math.abs(totalOwedToAto - totalOwedByAto); // 9

    return [
      { id: 'G1', description: 'Total sales', amount: totalSales },
      { id: '1A', description: 'GST on sales', amount: gstOnSales },
      { id: '1B', description: 'GST on purchases', amount: gstOnPurchases },
      { id: 'W1', description: 'Total salary and wages', amount: w1 },
      { id: 'W2', description: 'Amount withheld', amount: w2 },
      { id: '8A', description: 'Total owed to ATO', amount: totalOwedToAto },
      { id: '8B', description: 'Total owed by ATO', amount: totalOwedByAto },
      { id: '9', description: 'Net amount', amount: netAmount },
    ];
  }
}

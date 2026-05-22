import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  glJournalLines,
  glJournalEntries,
  customers,
  customerGroups,
  tradingTerms,
} from '../drizzle/modbm-core-schema';
import { eq, sql, and } from 'drizzle-orm';
import { resolveEffectiveTradingTermsId } from './credit-control.utils';

export interface CreditAssessmentResult {
  totalArBalance: number;
  overdueBalance: number;
  isOverdue: boolean;
}

@Injectable()
export class CreditAssessmentService {
  private readonly logger = new Logger(CreditAssessmentService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Calculates the current AR balance and overdue subset for an customer
   * dynamically from the General Ledger.
   * Uses a Balance Forward reduction strategy (all credits pay down oldest debts first).
   */
  async assessCredit(
    customerId: string,
    tx?: DrizzleDB,
  ): Promise<CreditAssessmentResult> {
    const db = tx || this.db;
    // 1. Fetch the customer, its group, and resolve its trading terms
    const acctList = await db
      .select({
        customerId: customers.customerId,
        accountTradingTermsId: customers.tradingTermsId,
        groupTradingTermsId: customerGroups.tradingTermsId,
      })
      .from(customers)
      .leftJoin(
        customerGroups,
        eq(customers.customerGroupId, customerGroups.customerGroupId),
      )
      .leftJoin(
        tradingTerms,
        eq(customers.tradingTermsId, tradingTerms.tradingTermsId),
      )
      .where(eq(customers.customerId, customerId))
      .limit(1);

    if (!acctList.length) {
      return { totalArBalance: 0, overdueBalance: 0, isOverdue: false };
    }

    const effectiveTermsId = resolveEffectiveTradingTermsId({
      creditLimit: null,
      isOnCreditHold: false,
      tradingTermsId: acctList[0].accountTradingTermsId,
      accountGroup: {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: acctList[0].groupTradingTermsId,
      },
    });

    let allowedDays = 0;
    if (effectiveTermsId) {
      const [terms] = await db
        .select()
        .from(tradingTerms)
        .where(eq(tradingTerms.tradingTermsId, effectiveTermsId))
        .limit(1);
      if (terms) {
        allowedDays = terms.days;
      }
    }

    // 2. Query the GL for all entries related to this party.
    // Calculate total debits, total credits, AND debits that are strictly older than the allowed days.
    const query = sql`
      SELECT 
        COALESCE(SUM(l.debit), 0) AS total_debits,
        COALESCE(SUM(l.credit), 0) AS total_credits,
        COALESCE(SUM(CASE 
          WHEN e.entry_date + (${allowedDays} || ' days')::interval < CURRENT_DATE 
          THEN l.debit ELSE 0 END), 0) AS overdue_debits
      FROM modbm_core.gl_journal_lines l
      JOIN modbm_core.gl_journal_entries e ON l.journal_entry_id = e.journal_entry_id
      WHERE l.party_id = ${customerId} AND l.party_type = 'customer'
    `;

    const result = await db.execute(query);
    const rows = (result as any).rows ?? result;
    const aggs = rows as unknown as {
      total_debits: string;
      total_credits: string;
      overdue_debits: string;
    }[];
    const payload = aggs[0];

    const totalDebits = parseFloat(payload?.total_debits || '0');
    const totalCredits = parseFloat(payload?.total_credits || '0');
    const overdueDebits = parseFloat(payload?.overdue_debits || '0');

    // Net AR = Debits - Credits
    const totalArBalance = totalDebits - totalCredits;

    // Overdue Balance (Balance Forward Strategy):
    // All paid credits inherently pay off the oldest debt lines first.
    // Therefore, Overdue Debt = MAX(0, Overdue Debits - Total Credits)
    const overdueBalance = Math.max(0, overdueDebits - totalCredits);

    return {
      totalArBalance,
      overdueBalance,
      isOverdue: overdueBalance > 0,
    };
  }
}

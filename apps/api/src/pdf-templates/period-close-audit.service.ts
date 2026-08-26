import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  glFiscalPeriods,
  organization,
  financialEvents,
  glSettings,
} from '@herobm/db-schema';
import { GlService } from '../gl/gl.service';
import { calculateSubledgerReconciliation } from '../gl/gl-reconciliation.utils';
import { classifyAndAggregateTrialBalance } from '../gl/gl-financial-statements.utils';
import { EntityType } from '../common/event-types';

export interface PeriodCloseAuditData {
  header: {
    orgName: string;
    orgAddress?: string;
    orgTaxId?: string;
    orgEmail?: string;
    orgPhone?: string;
    baseCurrency: string;
  };
  period: {
    periodId: string;
    periodName: string;
    fiscalYear: number;
    periodNumber: number;
    startDate: string;
    endDate: string;
    status: string;
    lockedBy?: string | null;
    lockedAt?: string | null;
    closedBy?: string | null;
    closedAt?: string | null;
    notes?: string | null;
  };
  executiveSummary: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    retainedEarningsAndNetIncome: number;
    isBalanceSheetBalanced: boolean;
    periodRevenue: number;
    periodExpenses: number;
    periodNetIncome: number;
    ytdRevenue: number;
    ytdExpenses: number;
    ytdNetIncome: number;
  };
  subledgerIntegrity: {
    isOverallBalanced: boolean;
    trialBalanceZeroSum: {
      totalDebit: number;
      totalCredit: number;
      netDifference: number;
      isBalanced: boolean;
    };
    accountsReceivable: {
      controlAccountCode: string;
      subledgerBalance: number;
      glBalance: number;
      drift: number;
      isMatched: boolean;
    };
    accountsPayable: {
      controlAccountCode: string;
      subledgerBalance: number;
      glBalance: number;
      drift: number;
      isMatched: boolean;
    };
    goodsReceivedNotInvoiced: {
      controlAccountCode: string;
      subledgerBalance: number;
      glBalance: number;
      drift: number;
      isMatched: boolean;
    };
    perpetualInventory: {
      controlAccountCode: string;
      subledgerBalance: number;
      glBalance: number;
      drift: number;
      isMatched: boolean;
    };
  };
  trialBalance: {
    categories: Array<{
      categoryName: string;
      accounts: Array<{
        accountCode: string;
        name: string;
        accountType: string;
        openingBalance: number;
        periodDebit: number;
        periodCredit: number;
        closingBalance: number;
        ytdBalance: number;
      }>;
      subtotal: {
        openingBalance: number;
        periodDebit: number;
        periodCredit: number;
        closingBalance: number;
        ytdBalance: number;
      };
    }>;
    grandTotals: {
      openingBalance: number;
      periodDebit: number;
      periodCredit: number;
      closingBalance: number;
      ytdDebit: number;
      ytdCredit: number;
      ytdBalance: number;
    };
  };
  timeline: Array<{
    eventType: string;
    entityDisplayName: string;
    createdOn: string;
    actor: string;
    notes?: string | null;
  }>;
  certification: {
    statement: string;
    preparedBy: string;
    reviewedBy: string;
    approvedBy: string;
    snapshotTimestamp: string;
    snapshotHash: string;
  };
  customPdfText?: string;
  generatedAt: string;
}

@Injectable()
export class PeriodCloseAuditService {
  private readonly logger = new Logger(PeriodCloseAuditService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
  ) {}

  async assembleData(
    periodId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Boundary auth user
    user?: any,
    options?: Record<string, unknown>,
  ): Promise<PeriodCloseAuditData> {
    const now = new Date();

    // 1. Resolve fiscal period by ID or Name
    const [period] = await this.db
      .select()
      .from(glFiscalPeriods)
      .where(
        sql`${glFiscalPeriods.periodId}::text = ${periodId} OR ${glFiscalPeriods.periodName} = ${periodId}`,
      )
      .limit(1);

    if (!period) {
      throw new NotFoundException(`Fiscal period '${periodId}' not found.`);
    }

    // 2. Fetch Organization and GL settings
    const [org] = await this.db.select().from(organization).limit(1);
    const [glSet] = await this.db
      .select({ baseCurrency: glSettings.baseCurrency })
      .from(glSettings)
      .limit(1);

    const baseCurrency = glSet?.baseCurrency || 'AUD';

    // 3. Fetch Trial Balance for the period
    const tbRows = await this.glService.getTrialBalance(
      period.endDate,
      period.startDate,
    );

    // 4. Run Subledger Reconciliation as of period end date
    const recon = await calculateSubledgerReconciliation(
      this.db,
      period.endDate,
    );

    // 5. Categorize and aggregate Trial Balance using centralized utility
    const classifiedTb = classifyAndAggregateTrialBalance(tbRows);

    // 6. Fetch timeline events for the period
    const rawEvents = await this.db
      .select()
      .from(financialEvents)
      .where(
        and(
          eq(financialEvents.entityType, EntityType.FISCAL_PERIOD),
          eq(financialEvents.entityId, period.periodId),
        ),
      )
      .orderBy(sql`${financialEvents.createdOn} ASC`);

    const timeline = rawEvents.map((e) => ({
      eventType: e.eventType,
      entityDisplayName: e.entityDisplayName || period.periodName,
      createdOn: e.createdOn
        ? new Date(e.createdOn).toISOString().replace('T', ' ').substring(0, 19)
        : '',
      actor: e.actor || 'system',
      notes:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON payload property
        (e.payload as any)?.notes || (e.payload as any)?.status || undefined,
    }));

    // 7. Cryptographic snapshot hash
    const snapshotPayload = `${period.periodId}:${period.periodName}:${period.status}:${classifiedTb.grandTotals.closingBalance}:${classifiedTb.grandTotals.ytdBalance}:${recon.isOverallBalanced}`;
    const snapshotHash = createHash('sha256')
      .update(snapshotPayload)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase();

    const actor = user?.username || user?.email || 'admin';
    const customPdfText = options?.customPdfText as string | undefined;

    return {
      header: {
        orgName: org?.name || 'HeroBM Enterprise Group',
        orgAddress:
          [
            org?.addressLine1,
            org?.addressLine2,
            org?.city,
            org?.state,
            org?.postCode,
            org?.country,
          ]
            .filter(Boolean)
            .join(', ') || undefined,
        orgTaxId: org?.taxNumber || org?.companyNumber || undefined,
        orgEmail: org?.email || undefined,
        orgPhone: org?.phone || undefined,
        baseCurrency,
      },
      period: {
        periodId: period.periodId,
        periodName: period.periodName,
        fiscalYear: period.fiscalYear,
        periodNumber: period.periodNumber,
        startDate: period.startDate,
        endDate: period.endDate,
        status: period.status,
        lockedBy: period.lockedBy,
        lockedAt: period.lockedAt
          ? new Date(period.lockedAt)
              .toISOString()
              .replace('T', ' ')
              .substring(0, 19)
          : null,
        closedBy: period.closedBy,
        closedAt: period.closedAt
          ? new Date(period.closedAt)
              .toISOString()
              .replace('T', ' ')
              .substring(0, 19)
          : null,
        notes: period.notes,
      },
      executiveSummary: classifiedTb.executiveSummary,
      subledgerIntegrity: {
        isOverallBalanced: recon.isOverallBalanced,
        trialBalanceZeroSum: {
          totalDebit: recon.trialBalanceZeroSum.totalDebit,
          totalCredit: recon.trialBalanceZeroSum.totalCredit,
          netDifference: recon.trialBalanceZeroSum.netDifference,
          isBalanced: recon.trialBalanceZeroSum.isBalanced,
        },
        accountsReceivable: {
          controlAccountCode: recon.accountsReceivable.controlAccountCode,
          subledgerBalance: recon.accountsReceivable.subledgerBalance,
          glBalance: recon.accountsReceivable.glBalance,
          drift: recon.accountsReceivable.drift,
          isMatched: recon.accountsReceivable.isMatched,
        },
        accountsPayable: {
          controlAccountCode: recon.accountsPayable.controlAccountCode,
          subledgerBalance: recon.accountsPayable.subledgerBalance,
          glBalance: recon.accountsPayable.glBalance,
          drift: recon.accountsPayable.drift,
          isMatched: recon.accountsPayable.isMatched,
        },
        goodsReceivedNotInvoiced: {
          controlAccountCode: recon.goodsReceivedNotInvoiced.controlAccountCode,
          subledgerBalance: recon.goodsReceivedNotInvoiced.subledgerBalance,
          glBalance: recon.goodsReceivedNotInvoiced.glBalance,
          drift: recon.goodsReceivedNotInvoiced.drift,
          isMatched: recon.goodsReceivedNotInvoiced.isMatched,
        },
        perpetualInventory: {
          controlAccountCode: recon.perpetualInventory.controlAccountCode,
          subledgerBalance: recon.perpetualInventory.subledgerBalance,
          glBalance: recon.perpetualInventory.glBalance,
          drift: recon.perpetualInventory.drift,
          isMatched: recon.perpetualInventory.isMatched,
        },
      },
      trialBalance: {
        categories: classifiedTb.categories,
        grandTotals: classifiedTb.grandTotals,
      },
      timeline,
      certification: {
        statement: `We hereby certify that the general ledger books, trial balance schedules, and subledger reconciliation registers for accounting period ${period.periodName} have been examined, reconciled against operational source journals, and formally verified in accordance with double-entry statutory accounting principles.`,
        preparedBy: period.closedBy || period.lockedBy || actor,
        reviewedBy: 'Chief Financial Officer',
        approvedBy: 'Statutory Auditor / Board Audit Committee',
        snapshotTimestamp: now.toISOString().replace('T', ' ').substring(0, 19),
        snapshotHash,
      },
      customPdfText: customPdfText || undefined,
      generatedAt: now.toISOString().replace('T', ' ').substring(0, 19),
    };
  }

  async getRandomId(): Promise<string | undefined> {
    const [row] = await this.db
      .select({ id: glFiscalPeriods.periodId })
      .from(glFiscalPeriods)
      .where(eq(glFiscalPeriods.status, 'hard_closed'))
      .limit(1);

    if (row?.id) return row.id;

    const [anyRow] = await this.db
      .select({ id: glFiscalPeriods.periodId })
      .from(glFiscalPeriods)
      .limit(1);

    return anyRow?.id || undefined;
  }

  generateMockData(): PeriodCloseAuditData {
    return {
      header: {
        orgName: 'HeroBM Industrial Holdings Pty Ltd',
        orgAddress: '100 Miller Street, North Sydney NSW 2060, Australia',
        orgTaxId: 'ABN 45 123 456 789',
        orgEmail: 'finance@herobm.com',
        orgPhone: '+61 2 8000 1234',
        baseCurrency: 'AUD',
      },
      period: {
        periodId: '00000000-0000-0000-0000-000000000001',
        periodName: '2026-08',
        fiscalYear: 2026,
        periodNumber: 8,
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        status: 'hard_closed',
        lockedBy: 'financial.controller@herobm.com',
        lockedAt: '2026-08-31 18:00:00',
        closedBy: 'cfo@herobm.com',
        closedAt: '2026-08-31 23:59:59',
        notes: 'Monthly hard close certified and reconciled.',
      },
      executiveSummary: {
        totalAssets: 485000.0,
        totalLiabilities: 185000.0,
        totalEquity: 250000.0,
        retainedEarningsAndNetIncome: 485000.0,
        isBalanceSheetBalanced: true,
        periodRevenue: 120000.0,
        periodExpenses: 70000.0,
        periodNetIncome: 50000.0,
        ytdRevenue: 850000.0,
        ytdExpenses: 550000.0,
        ytdNetIncome: 300000.0,
      },
      subledgerIntegrity: {
        isOverallBalanced: true,
        trialBalanceZeroSum: {
          totalDebit: 650000.0,
          totalCredit: 650000.0,
          netDifference: 0.0,
          isBalanced: true,
        },
        accountsReceivable: {
          controlAccountCode: '1200',
          subledgerBalance: 45000.0,
          glBalance: 45000.0,
          drift: 0.0,
          isMatched: true,
        },
        accountsPayable: {
          controlAccountCode: '2000',
          subledgerBalance: 32000.0,
          glBalance: 32000.0,
          drift: 0.0,
          isMatched: true,
        },
        goodsReceivedNotInvoiced: {
          controlAccountCode: '2150',
          subledgerBalance: 12500.0,
          glBalance: 12500.0,
          drift: 0.0,
          isMatched: true,
        },
        perpetualInventory: {
          controlAccountCode: '1300',
          subledgerBalance: 115000.0,
          glBalance: 115000.0,
          drift: 0.0,
          isMatched: true,
        },
      },
      trialBalance: {
        categories: [
          {
            categoryName: 'Assets (1000 - 1999)',
            accounts: [
              {
                accountCode: '1000',
                name: 'Operating Bank Account',
                accountType: 'asset',
                openingBalance: 120000.0,
                periodDebit: 80000.0,
                periodCredit: 50000.0,
                closingBalance: 150000.0,
                ytdBalance: 150000.0,
              },
              {
                accountCode: '1200',
                name: 'Trade Debtors (AR)',
                accountType: 'asset',
                openingBalance: 40000.0,
                periodDebit: 55000.0,
                periodCredit: 50000.0,
                closingBalance: 45000.0,
                ytdBalance: 45000.0,
              },
              {
                accountCode: '1300',
                name: 'Perpetual Inventory',
                accountType: 'asset',
                openingBalance: 110000.0,
                periodDebit: 35000.0,
                periodCredit: 30000.0,
                closingBalance: 115000.0,
                ytdBalance: 115000.0,
              },
            ],
            subtotal: {
              openingBalance: 270000.0,
              periodDebit: 170000.0,
              periodCredit: 130000.0,
              closingBalance: 310000.0,
              ytdBalance: 310000.0,
            },
          },
        ],
        grandTotals: {
          openingBalance: 0.0,
          periodDebit: 650000.0,
          periodCredit: 650000.0,
          closingBalance: 0.0,
          ytdDebit: 4500000.0,
          ytdCredit: 4500000.0,
          ytdBalance: 0.0,
        },
      },
      timeline: [
        {
          eventType: 'created',
          entityDisplayName: '2026-08',
          createdOn: '2026-08-01 00:00:00',
          actor: 'system',
          notes: 'Auto-generated fiscal period 2026-08',
        },
        {
          eventType: 'status_changed',
          entityDisplayName: '2026-08',
          createdOn: '2026-08-31 18:00:00',
          actor: 'financial.controller@herobm.com',
          notes: 'Soft locked for end-of-month review',
        },
        {
          eventType: 'status_changed',
          entityDisplayName: '2026-08',
          createdOn: '2026-08-31 23:59:59',
          actor: 'cfo@herobm.com',
          notes: 'Hard closed and books finalized',
        },
      ],
      certification: {
        statement:
          'We hereby certify that the general ledger books, trial balance schedules, and subledger reconciliation registers for accounting period 2026-08 have been examined, reconciled against operational source journals, and formally verified in accordance with double-entry statutory accounting principles.',
        preparedBy: 'financial.controller@herobm.com',
        reviewedBy: 'Chief Financial Officer',
        approvedBy: 'Statutory Auditor / Board Audit Committee',
        snapshotTimestamp: '2026-08-31 23:59:59',
        snapshotHash: 'A9B4C2D1E8F76302',
      },
      customPdfText: undefined,
      generatedAt: '2026-08-31 23:59:59',
    };
  }
}

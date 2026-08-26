import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { sql, eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { organization, glSettings, glFiscalPeriods } from '@herobm/db-schema';
import {
  calculateCashFlowStatement,
  CalculateCashFlowOptions,
  CashFlowStatementResult,
} from './gl-cash-flow.utils';

export interface CashFlowStatementData {
  header: {
    orgName: string;
    orgAddress?: string;
    orgTaxId?: string;
    orgEmail?: string;
    orgPhone?: string;
    baseCurrency: string;
  };
  period: {
    startDate: string;
    endDate: string;
    periodName?: string;
    fiscalYear?: number;
    periodNumber?: number;
  };
  operatingActivities: {
    title: string;
    lines: Array<{
      id: string;
      name: string;
      category: 'operating' | 'investing' | 'financing';
      amount: number;
    }>;
    netCash: number;
  };
  investingActivities: {
    title: string;
    lines: Array<{
      id: string;
      name: string;
      category: 'operating' | 'investing' | 'financing';
      amount: number;
    }>;
    netCash: number;
  };
  financingActivities: {
    title: string;
    lines: Array<{
      id: string;
      name: string;
      category: 'operating' | 'investing' | 'financing';
      amount: number;
    }>;
    netCash: number;
  };
  reconciliation: {
    beginningCash: number;
    netChangeInCash: number;
    endingCash: number;
    glCashBalance: number;
    drift: number;
    isReconciled: boolean;
  };
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
export class CashFlowService {
  private readonly logger = new Logger(CashFlowService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getCashFlowStatement(
    options: CalculateCashFlowOptions,
  ): Promise<CashFlowStatementResult> {
    return calculateCashFlowStatement(this.db, options);
  }

  async assembleData(
    idOrDateRange: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Boundary auth user
    user?: any,
    options?: Record<string, unknown>,
  ): Promise<CashFlowStatementData> {
    const now = new Date();
    let startDate = options?.startDate as string | undefined;
    let endDate = options?.endDate as string | undefined;
    let periodName: string | undefined;
    let fiscalYear: number | undefined;
    let periodNumber: number | undefined;

    // Check if identifier is a Fiscal Period ID or Name
    if (idOrDateRange && idOrDateRange !== 'default') {
      const [period] = await this.db
        .select()
        .from(glFiscalPeriods)
        .where(
          sql`${glFiscalPeriods.periodId}::text = ${idOrDateRange} OR ${glFiscalPeriods.periodName} = ${idOrDateRange}`,
        )
        .limit(1);

      if (period) {
        startDate = period.startDate;
        endDate = period.endDate;
        periodName = period.periodName;
        fiscalYear = period.fiscalYear;
        periodNumber = period.periodNumber;
      }
    }

    if (!startDate || !endDate) {
      // Default to current month if no dates provided
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      startDate = startDate || `${year}-${month}-01`;
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      endDate =
        endDate || `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    }

    const [org] = await this.db.select().from(organization).limit(1);
    const [glSet] = await this.db
      .select({ baseCurrency: glSettings.baseCurrency })
      .from(glSettings)
      .limit(1);

    const baseCurrency = glSet?.baseCurrency || 'AUD';

    const result = await calculateCashFlowStatement(this.db, {
      startDate,
      endDate,
      periodName,
      fiscalYear,
      periodNumber,
    });

    const snapshotPayload = `${startDate}:${endDate}:${result.reconciliation.netChangeInCash}:${result.reconciliation.endingCash}:${result.reconciliation.isReconciled}`;
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
      period: result.period,
      operatingActivities: result.operatingActivities,
      investingActivities: result.investingActivities,
      financingActivities: result.financingActivities,
      reconciliation: result.reconciliation,
      certification: {
        statement: `We hereby certify that the Statement of Cash Flows for the period ${startDate} to ${endDate} has been calculated and reconciled against the General Ledger bank and cash control registers in accordance with statutory accounting standards.`,
        preparedBy: actor,
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

  generateMockData(): CashFlowStatementData {
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
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        periodName: '2026-08',
        fiscalYear: 2026,
        periodNumber: 8,
      },
      operatingActivities: {
        title: 'Cash Flows from Operating Activities',
        lines: [
          {
            id: 'op-customers',
            name: 'Cash Receipts from Customers & Sales',
            category: 'operating',
            amount: 145000.0,
          },
          {
            id: 'op-suppliers',
            name: 'Cash Paid to Suppliers & Inventory',
            category: 'operating',
            amount: -62000.0,
          },
          {
            id: 'op-employees',
            name: 'Cash Paid to Employees & Payroll',
            category: 'operating',
            amount: -35000.0,
          },
          {
            id: 'op-tax',
            name: 'Income Tax & GST Payments (Net)',
            category: 'operating',
            amount: -8500.0,
          },
          {
            id: 'op-interest',
            name: 'Interest & Finance Charges Paid',
            category: 'operating',
            amount: -1200.0,
          },
        ],
        netCash: 38300.0,
      },
      investingActivities: {
        title: 'Cash Flows from Investing Activities',
        lines: [
          {
            id: 'inv-capex',
            name: 'Purchase of Property, Plant & Equipment (Capex)',
            category: 'investing',
            amount: -18500.0,
          },
          {
            id: 'inv-disposals',
            name: 'Proceeds from Sale of Fixed Assets',
            category: 'investing',
            amount: 4000.0,
          },
        ],
        netCash: -14500.0,
      },
      financingActivities: {
        title: 'Cash Flows from Financing Activities',
        lines: [
          {
            id: 'fin-loans',
            name: 'Proceeds from Borrowings & Bank Facilities',
            category: 'financing',
            amount: 25000.0,
          },
          {
            id: 'fin-repayments',
            name: 'Repayment of Borrowings & Leases',
            category: 'financing',
            amount: -10000.0,
          },
        ],
        netCash: 15000.0,
      },
      reconciliation: {
        beginningCash: 120000.0,
        netChangeInCash: 38800.0,
        endingCash: 158800.0,
        glCashBalance: 158800.0,
        drift: 0.0,
        isReconciled: true,
      },
      certification: {
        statement:
          'We hereby certify that the Statement of Cash Flows for the period 2026-08-01 to 2026-08-31 has been calculated and reconciled against the General Ledger bank and cash control registers in accordance with statutory accounting standards.',
        preparedBy: 'controller@herobm.com',
        reviewedBy: 'Chief Financial Officer',
        approvedBy: 'Statutory Auditor / Board Audit Committee',
        snapshotTimestamp: '2026-08-31 23:59:59',
        snapshotHash: '8E4C1B9A2F73D05E',
      },
      customPdfText: undefined,
      generatedAt: '2026-08-31 23:59:59',
    };
  }
}

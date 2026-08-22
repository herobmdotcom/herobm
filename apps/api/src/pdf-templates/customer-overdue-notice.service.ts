import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, notInArray, asc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { AppConfigService } from '../settings/app-config.service';
import {
  customers,
  actors,
  tradingTerms,
  salesInvoices,
  glAccounts,
} from '@herobm/db-schema';
import { SALES_INVOICE_STATE } from '@herobm/shared';

export interface CustomerOverdueNoticeData {
  header: {
    customerId: string;
    customerNumber: string;
    customerName: string;
    billingAddress: string;
    customerContact: string;
    noticeDate: string;
    paymentTerms: string;
    creditLimit: string;
    currencyCode: string;
    state?: string;
    noticeLevel: string;
    noticeTitle: string;
  };
  lines: Array<{
    invoiceDate: string;
    invoiceNumber: string;
    customerOrderNumber: string;
    dueDate: string;
    daysOverdue: number;
    originalAmount: string;
    overdueAmount: string;
  }>;
  aging: {
    current: string;
    days1To30: string;
    days31To60: string;
    days61To90: string;
    days90Plus: string;
  };
  summary: {
    totalOverdue: string;
    totalOutstanding: string;
    overdueInvoiceCount: number;
    maxDaysOverdue: number;
  };
  bank: {
    bankName: string;
    accountName: string;
    bsb: string;
    accountNumber: string;
    remittanceEmail?: string;
  };
  customPdfText?: string;
  quoteIntroText?: string;
  generatedAt: string;
}

@Injectable()
export class CustomerOverdueNoticeService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly appConfig: AppConfigService,
  ) {}

  private readonly logger = new Logger(CustomerOverdueNoticeService.name);

  async assembleData(
    customerId: string,
    options?: Record<string, unknown>,
  ): Promise<CustomerOverdueNoticeData> {
    const [cust] = await this.db
      .select({
        customerId: customers.customerId,
        customerNumber: customers.customerNumber,
        currencyCode: customers.currencyCode,
        creditLimit: customers.creditLimit,
        stateCode: customers.stateCode,
        termsDescription: tradingTerms.description,
        termsCode: tradingTerms.code,
        name: actors.name,
        headquartersAddressLine1: actors.headquartersAddressLine1,
        city: actors.headquartersCity,
        stateOrProvince: actors.headquartersStateOrProvince,
        postalCode: actors.headquartersPostalCode,
        country: actors.headquartersCountry,
      })
      .from(customers)
      .leftJoin(actors, eq(customers.actorId, actors.actorId))
      .leftJoin(
        tradingTerms,
        eq(customers.tradingTermsId, tradingTerms.tradingTermsId),
      )
      .where(eq(customers.customerId, customerId))
      .limit(1);

    if (!cust) {
      throw new NotFoundException(`Customer '${customerId}' not found`);
    }

    const now = new Date();

    // 1. Fetch Outstanding Sales Invoices
    const allInvoices = await this.db
      .select({
        invoiceId: salesInvoices.invoiceId,
        invoiceNumber: salesInvoices.invoiceNumber,
        customerOrderNumber: salesInvoices.customerOrderNumber,
        invoiceDate: salesInvoices.invoiceDate,
        dueDate: salesInvoices.dueDate,
        totalAmount: salesInvoices.totalAmount,
        outstandingAmount: salesInvoices.outstandingAmount,
        stateCode: salesInvoices.stateCode,
        createdOn: salesInvoices.createdOn,
      })
      .from(salesInvoices)
      .where(
        and(
          eq(salesInvoices.customerId, customerId),
          notInArray(salesInvoices.stateCode, [
            SALES_INVOICE_STATE.DRAFT,
            SALES_INVOICE_STATE.CANCELLED,
          ]),
        ),
      )
      .orderBy(asc(salesInvoices.dueDate));

    // 2. Separate Overdue Invoices and compute aging buckets
    let current = 0;
    let days1To30 = 0;
    let days31To60 = 0;
    let days61To90 = 0;
    let days90Plus = 0;

    let totalOverdue = 0;
    let totalOutstanding = 0;
    let maxDaysOverdue = 0;

    const overdueLines: CustomerOverdueNoticeData['lines'] = [];

    for (const inv of allInvoices) {
      const outstanding = parseFloat(inv.outstandingAmount || '0');
      if (outstanding <= 0) continue;

      totalOutstanding += outstanding;

      const dueDate = inv.dueDate
        ? new Date(inv.dueDate)
        : inv.invoiceDate
          ? new Date(inv.invoiceDate)
          : now;

      const diffMs = now.getTime() - dueDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        current += outstanding;
      } else {
        totalOverdue += outstanding;
        if (diffDays > maxDaysOverdue) {
          maxDaysOverdue = diffDays;
        }

        if (diffDays <= 30) {
          days1To30 += outstanding;
        } else if (diffDays <= 60) {
          days31To60 += outstanding;
        } else if (diffDays <= 90) {
          days61To90 += outstanding;
        } else {
          days90Plus += outstanding;
        }

        const invDateStr = inv.invoiceDate
          ? new Date(inv.invoiceDate).toLocaleDateString('en-IE')
          : inv.createdOn
            ? new Date(inv.createdOn).toLocaleDateString('en-IE')
            : '—';
        const dueDateStr = inv.dueDate
          ? new Date(inv.dueDate).toLocaleDateString('en-IE')
          : '—';

        overdueLines.push({
          invoiceDate: invDateStr,
          invoiceNumber: inv.invoiceNumber,
          customerOrderNumber: inv.customerOrderNumber || '—',
          dueDate: dueDateStr,
          daysOverdue: Math.max(1, diffDays),
          originalAmount: parseFloat(inv.totalAmount || '0').toFixed(2),
          overdueAmount: outstanding.toFixed(2),
        });
      }
    }

    // 3. Determine Notice Level & Title
    let noticeLevel = 'Reminder';
    let noticeTitle = 'OVERDUE PAYMENT REMINDER';
    if (maxDaysOverdue > 60) {
      noticeLevel = 'Final Notice';
      noticeTitle = 'FINAL DEMAND / OVERDUE NOTICE';
    } else if (maxDaysOverdue > 30) {
      noticeLevel = 'Second Notice';
      noticeTitle = 'OVERDUE PAYMENT NOTICE';
    }

    // 4. Fetch Bank Account details for remittance slip
    const [bankAccount] = await this.db
      .select({
        accountName: glAccounts.name,
        metadata: glAccounts.metadata,
      })
      .from(glAccounts)
      .where(eq(glAccounts.isBankAccount, true))
      .limit(1);

    const bankMeta = bankAccount?.metadata || {};
    const bankDetails = {
      bankName: (bankMeta.bankName as string) || 'Standard Bank',
      accountName: bankAccount?.accountName || 'Accounts Department',
      bsb:
        (bankMeta.bsb as string) ||
        (bankMeta.routingNumber as string) ||
        '000-000',
      accountNumber: (bankMeta.accountNumber as string) || '12345678',
      remittanceEmail: 'accounts@modbm.internal',
    };

    const billingAddressParts = [
      cust.headquartersAddressLine1,
      cust.city,
      cust.stateOrProvince,
      cust.postalCode,
      cust.country,
    ].filter(Boolean);

    const customText =
      (options?.customPdfText as string) || (options?.quoteIntroText as string);

    return {
      header: {
        customerId: cust.customerId,
        customerNumber: cust.customerNumber,
        customerName: cust.name || '—',
        billingAddress: billingAddressParts.join(', '),
        customerContact: '',
        noticeDate: now.toLocaleDateString('en-IE'),
        paymentTerms: cust.termsDescription || cust.termsCode || '30 Days',
        creditLimit: cust.creditLimit?.toString() || '',
        currencyCode: cust.currencyCode || this.appConfig.homeCurrency(),
        state: cust.stateCode,
        noticeLevel,
        noticeTitle,
      },
      lines: overdueLines,
      aging: {
        current: current.toFixed(2),
        days1To30: days1To30.toFixed(2),
        days31To60: days31To60.toFixed(2),
        days61To90: days61To90.toFixed(2),
        days90Plus: days90Plus.toFixed(2),
      },
      summary: {
        totalOverdue: totalOverdue.toFixed(2),
        totalOutstanding: totalOutstanding.toFixed(2),
        overdueInvoiceCount: overdueLines.length,
        maxDaysOverdue,
      },
      bank: bankDetails,
      customPdfText: customText || undefined,
      quoteIntroText: customText || undefined,
      generatedAt: now.toISOString().replace('T', ' ').substring(0, 19),
    };
  }
}

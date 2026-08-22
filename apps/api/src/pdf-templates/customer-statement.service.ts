import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, notInArray, asc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  customers,
  actors,
  tradingTerms,
  salesInvoices,
  salesCreditNotes,
  paymentEntries,
  glAccounts,
  glSettings,
} from '@herobm/db-schema';
import {
  SALES_INVOICE_STATE,
  SALES_CREDIT_NOTE_STATE,
  PAYMENT_STATE,
} from '@herobm/shared';

export interface CustomerStatementData {
  header: {
    customerId: string;
    customerNumber: string;
    customerName: string;
    billingAddress: string;
    customerContact: string;
    statementDate: string;
    paymentTerms: string;
    creditLimit: string;
    currencyCode: string;
    state?: string;
  };
  lines: Array<{
    date: string;
    type: string;
    documentNumber: string;
    reference: string;
    dueDate: string;
    debit: string;
    credit: string;
    runningBalance: string;
  }>;
  aging: {
    current: string;
    days1To30: string;
    days31To60: string;
    days61To90: string;
    days90Plus: string;
  };
  summary: {
    totalDebits: string;
    totalCredits: string;
    totalOutstanding: string;
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
export class CustomerStatementService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private readonly logger = new Logger(CustomerStatementService.name);

  async assembleData(
    customerId: string,
    options?: Record<string, unknown>,
  ): Promise<CustomerStatementData> {
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

    const [gl] = await this.db
      .select({ baseCurrency: glSettings.baseCurrency })
      .from(glSettings)
      .limit(1);
    const baseCurrency = gl?.baseCurrency || 'AUD';

    // 1. Fetch Sales Invoices
    const invoices = await this.db
      .select({
        invoiceId: salesInvoices.invoiceId,
        invoiceNumber: salesInvoices.invoiceNumber,
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
      .orderBy(asc(salesInvoices.invoiceDate));

    // 2. Fetch Sales Credit Notes
    const creditNotes = await this.db
      .select({
        creditNoteId: salesCreditNotes.creditNoteId,
        creditNoteNumber: salesCreditNotes.creditNoteNumber,
        totalAmount: salesCreditNotes.totalAmount,
        outstandingAmount: salesCreditNotes.outstandingAmount,
        stateCode: salesCreditNotes.stateCode,
        createdOn: salesCreditNotes.createdOn,
      })
      .from(salesCreditNotes)
      .where(
        and(
          eq(salesCreditNotes.customerId, customerId),
          notInArray(salesCreditNotes.stateCode, [
            SALES_CREDIT_NOTE_STATE.DRAFT,
            SALES_CREDIT_NOTE_STATE.CANCELLED,
          ]),
        ),
      )
      .orderBy(asc(salesCreditNotes.createdOn));

    // 3. Fetch Customer Payments
    const payments = await this.db
      .select({
        paymentId: paymentEntries.paymentId,
        paymentNumber: paymentEntries.paymentNumber,
        paymentDate: paymentEntries.paymentDate,
        modeOfPayment: paymentEntries.modeOfPayment,
        totalAmount: paymentEntries.totalAmount,
        createdOn: paymentEntries.createdOn,
      })
      .from(paymentEntries)
      .where(
        and(
          eq(paymentEntries.partyId, customerId),
          notInArray(paymentEntries.stateCode, [
            PAYMENT_STATE.DRAFT,
            PAYMENT_STATE.CANCELLED,
          ]),
        ),
      )
      .orderBy(asc(paymentEntries.paymentDate));

    // 4. Combine into chronological ledger
    interface RawTx {
      date: Date;
      type: string;
      documentNumber: string;
      reference: string;
      dueDate: string;
      debit: number;
      credit: number;
    }

    const txs: RawTx[] = [];

    for (const inv of invoices) {
      const invDate = inv.invoiceDate
        ? new Date(inv.invoiceDate)
        : inv.createdOn
          ? new Date(inv.createdOn)
          : new Date();
      const dueDateStr = inv.dueDate
        ? new Date(inv.dueDate).toLocaleDateString('en-IE')
        : '—';
      const amount = parseFloat(inv.totalAmount || '0');

      txs.push({
        date: invDate,
        type: 'Invoice',
        documentNumber: inv.invoiceNumber,
        reference: '',
        dueDate: dueDateStr,
        debit: amount,
        credit: 0,
      });
    }

    for (const cr of creditNotes) {
      const crDate = cr.createdOn ? new Date(cr.createdOn) : new Date();
      const amount = parseFloat(cr.totalAmount || '0');

      txs.push({
        date: crDate,
        type: 'Credit Note',
        documentNumber: cr.creditNoteNumber,
        reference: '',
        dueDate: '—',
        debit: 0,
        credit: amount,
      });
    }

    for (const pmt of payments) {
      const pmtDate = pmt.paymentDate
        ? new Date(pmt.paymentDate)
        : pmt.createdOn
          ? new Date(pmt.createdOn)
          : new Date();
      const amount = parseFloat(pmt.totalAmount || '0');

      txs.push({
        date: pmtDate,
        type: 'Payment',
        documentNumber: pmt.paymentNumber || 'Receipt',
        reference: pmt.modeOfPayment || '',
        dueDate: '—',
        debit: 0,
        credit: amount,
      });
    }

    // Sort by date ascending
    txs.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBalance = 0;
    let totalDebits = 0;
    let totalCredits = 0;

    const lines = txs.map((t) => {
      totalDebits += t.debit;
      totalCredits += t.credit;
      runningBalance += t.debit - t.credit;

      return {
        date: t.date.toLocaleDateString('en-IE'),
        type: t.type,
        documentNumber: t.documentNumber,
        reference: t.reference,
        dueDate: t.dueDate,
        debit: t.debit > 0 ? t.debit.toFixed(2) : '0.00',
        credit: t.credit > 0 ? t.credit.toFixed(2) : '0.00',
        runningBalance: runningBalance.toFixed(2),
      };
    });

    // 5. Calculate Aged Receivables breakdown from outstanding invoices
    const now = new Date();
    let current = 0;
    let days1To30 = 0;
    let days31To60 = 0;
    let days61To90 = 0;
    let days90Plus = 0;

    for (const inv of invoices) {
      const outstanding = parseFloat(inv.outstandingAmount || '0');
      if (outstanding <= 0) continue;

      const dueDate = inv.dueDate
        ? new Date(inv.dueDate)
        : inv.invoiceDate
          ? new Date(inv.invoiceDate)
          : now;
      const diffMs = now.getTime() - dueDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        current += outstanding;
      } else if (diffDays <= 30) {
        days1To30 += outstanding;
      } else if (diffDays <= 60) {
        days31To60 += outstanding;
      } else if (diffDays <= 90) {
        days61To90 += outstanding;
      } else {
        days90Plus += outstanding;
      }
    }

    // 6. Fetch Bank Account details for remittance slip
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
        statementDate: now.toLocaleDateString('en-IE'),
        paymentTerms: cust.termsDescription || cust.termsCode || '30 Days',
        creditLimit: cust.creditLimit?.toString() || '',
        currencyCode: cust.currencyCode || baseCurrency,
        state: cust.stateCode,
      },
      lines,
      aging: {
        current: current.toFixed(2),
        days1To30: days1To30.toFixed(2),
        days31To60: days31To60.toFixed(2),
        days61To90: days61To90.toFixed(2),
        days90Plus: days90Plus.toFixed(2),
      },
      summary: {
        totalDebits: totalDebits.toFixed(2),
        totalCredits: totalCredits.toFixed(2),
        totalOutstanding: Math.max(0, runningBalance).toFixed(2),
      },
      bank: bankDetails,
      customPdfText: customText || undefined,
      quoteIntroText: customText || undefined,
      generatedAt: now.toISOString().replace('T', ' ').substring(0, 19),
    };
  }
}

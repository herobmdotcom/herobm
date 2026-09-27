import Decimal from 'decimal.js';

/**
 * Pure Single-Source Accounting Calculation Engine
 *
 * Guarantees that document totals (AR/AP headers) and GL journal lines
 * are generated from a single, deterministic mathematical pipeline.
 */

export interface PureJournalLine {
  accountId?: string;
  accountCode?: string;
  debit: number;
  credit: number;
  foreignDebit?: number;
  foreignCredit?: number;
  foreignCurrencyCode?: string;
  exchangeRate?: number;
  memo?: string;
  partyId?: string;
  partyType?: 'customer' | 'supplier';
  costCenterId?: string;
  activityId?: string;
}

export interface PureSalesInvoiceLineInput {
  revenueAccountCode: string;
  netAmount: number;
  taxAmount?: number;
  salesTaxAccountCode?: string;
  description?: string;
  costCenterId?: string;
  activityId?: string;
}

export interface PureSalesInvoiceAccountingInput {
  invoiceNumber: string;
  arAccountCode: string;
  customerId: string;
  currencyCode: string;
  exchangeRate: number;
  lines: PureSalesInvoiceLineInput[];
  costCenterId?: string;
  activityId?: string;
}

export interface PureSalesInvoiceAccountingResult {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  baseGrandTotal: number;
  journalLines: PureJournalLine[];
}

/**
 * Pure function computing sales invoice header totals and balanced GL journal lines.
 */
export function calculateSalesInvoiceFinancials(
  input: PureSalesInvoiceAccountingInput,
): PureSalesInvoiceAccountingResult {
  let subtotal = new Decimal(0);
  let taxTotal = new Decimal(0);
  const journalLines: PureJournalLine[] = [];

  const rate = new Decimal(input.exchangeRate > 0 ? input.exchangeRate : 1);

  for (const line of input.lines) {
    const net = new Decimal(line.netAmount || 0).toDecimalPlaces(2);
    const tax = new Decimal(line.taxAmount || 0).toDecimalPlaces(2);

    subtotal = subtotal.plus(net);
    taxTotal = taxTotal.plus(tax);

    const baseNet = net.mul(rate).toDecimalPlaces(2);

    // Revenue Credit
    journalLines.push({
      accountCode: line.revenueAccountCode,
      debit: 0,
      credit: baseNet.toNumber(),
      foreignDebit: 0,
      foreignCredit: net.toNumber(),
      foreignCurrencyCode: input.currencyCode,
      exchangeRate: rate.toNumber(),
      memo: line.description || `Revenue: ${input.invoiceNumber}`,
      costCenterId: line.costCenterId || input.costCenterId,
      activityId: line.activityId || input.activityId,
    });

    // Sales Tax Credit (if tax applies)
    if (tax.greaterThan(0) && line.salesTaxAccountCode) {
      const baseTax = tax.mul(rate).toDecimalPlaces(2);
      journalLines.push({
        accountCode: line.salesTaxAccountCode,
        debit: 0,
        credit: baseTax.toNumber(),
        foreignDebit: 0,
        foreignCredit: tax.toNumber(),
        foreignCurrencyCode: input.currencyCode,
        exchangeRate: rate.toNumber(),
        memo: `Sales Tax: ${input.invoiceNumber}`,
        costCenterId: line.costCenterId || input.costCenterId,
        activityId: line.activityId || input.activityId,
      });
    }
  }

  const roundedSubtotal = subtotal.toDecimalPlaces(2);
  const roundedTaxTotal = taxTotal.toDecimalPlaces(2);
  const grandTotal = roundedSubtotal.plus(roundedTaxTotal).toDecimalPlaces(2);
  const baseGrandTotal = grandTotal.mul(rate).toDecimalPlaces(2);

  // AR Debit (Header Total)
  journalLines.unshift({
    accountCode: input.arAccountCode,
    debit: baseGrandTotal.toNumber(),
    credit: 0,
    foreignDebit: grandTotal.toNumber(),
    foreignCredit: 0,
    foreignCurrencyCode: input.currencyCode,
    exchangeRate: rate.toNumber(),
    memo: `Accounts Receivable: ${input.invoiceNumber}`,
    partyType: 'customer',
    partyId: input.customerId,
    costCenterId: input.costCenterId,
    activityId: input.activityId,
  });

  return {
    subtotal: roundedSubtotal.toNumber(),
    taxTotal: roundedTaxTotal.toNumber(),
    grandTotal: grandTotal.toNumber(),
    baseGrandTotal: baseGrandTotal.toNumber(),
    journalLines,
  };
}

/**
 * Pure function to reverse any journal line array by inverting debits and credits.
 */
export function buildReversalJournalLines(
  lines: PureJournalLine[],
  memoPrefix = 'Cancellation Reversal: ',
): PureJournalLine[] {
  return lines.map((line) => ({
    accountId: line.accountId,
    accountCode: line.accountCode,
    debit: line.credit,
    credit: line.debit,
    foreignDebit: line.foreignCredit,
    foreignCredit: line.foreignDebit,
    foreignCurrencyCode: line.foreignCurrencyCode,
    exchangeRate: line.exchangeRate,
    memo: line.memo ? `${memoPrefix}${line.memo}` : undefined,
    partyId: line.partyId,
    partyType: line.partyType,
    costCenterId: line.costCenterId,
    activityId: line.activityId,
  }));
}

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
  let subtotal = 0;
  let taxTotal = 0;
  const journalLines: PureJournalLine[] = [];

  const rate = input.exchangeRate > 0 ? input.exchangeRate : 1;

  for (const line of input.lines) {
    const net = Math.round(line.netAmount * 100) / 100;
    const tax = Math.round((line.taxAmount || 0) * 100) / 100;

    subtotal += net;
    taxTotal += tax;

    const baseNet = Math.round(net * rate * 100) / 100;

    // Revenue Credit
    journalLines.push({
      accountCode: line.revenueAccountCode,
      debit: 0,
      credit: baseNet,
      foreignDebit: 0,
      foreignCredit: net,
      foreignCurrencyCode: input.currencyCode,
      exchangeRate: rate,
      memo: line.description || `Revenue: ${input.invoiceNumber}`,
      costCenterId: line.costCenterId || input.costCenterId,
      activityId: line.activityId || input.activityId,
    });

    // Sales Tax Credit (if tax applies)
    if (tax > 0 && line.salesTaxAccountCode) {
      const baseTax = Math.round(tax * rate * 100) / 100;
      journalLines.push({
        accountCode: line.salesTaxAccountCode,
        debit: 0,
        credit: baseTax,
        foreignDebit: 0,
        foreignCredit: tax,
        foreignCurrencyCode: input.currencyCode,
        exchangeRate: rate,
        memo: `Sales Tax: ${input.invoiceNumber}`,
        costCenterId: line.costCenterId || input.costCenterId,
        activityId: line.activityId || input.activityId,
      });
    }
  }

  subtotal = Math.round(subtotal * 100) / 100;
  taxTotal = Math.round(taxTotal * 100) / 100;
  const grandTotal = Math.round((subtotal + taxTotal) * 100) / 100;
  const baseGrandTotal = Math.round(grandTotal * rate * 100) / 100;

  // AR Debit (Header Total)
  journalLines.unshift({
    accountCode: input.arAccountCode,
    debit: baseGrandTotal,
    credit: 0,
    foreignDebit: grandTotal,
    foreignCredit: 0,
    foreignCurrencyCode: input.currencyCode,
    exchangeRate: rate,
    memo: `Accounts Receivable: ${input.invoiceNumber}`,
    partyType: 'customer',
    partyId: input.customerId,
    costCenterId: input.costCenterId,
    activityId: input.activityId,
  });

  return {
    subtotal,
    taxTotal,
    grandTotal,
    baseGrandTotal,
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

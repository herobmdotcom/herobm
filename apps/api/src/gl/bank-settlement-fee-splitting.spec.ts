import Decimal from 'decimal.js';

describe('Bank Feed Settlement Batch Reconciliation & Fee Splitting (Unit)', () => {
  function validateJournalBalance(lines: { debit: number; credit: number }[]) {
    const totalDebitDec = lines.reduce(
      (sum, l) => sum.plus(new Decimal(l.debit || 0).toDecimalPlaces(2)),
      new Decimal(0),
    );
    const totalCreditDec = lines.reduce(
      (sum, l) => sum.plus(new Decimal(l.credit || 0).toDecimalPlaces(2)),
      new Decimal(0),
    );

    if (!totalDebitDec.equals(totalCreditDec)) {
      throw new Error(
        `Journal entry is unbalanced: debit=${totalDebitDec.toFixed(2)}, credit=${totalCreditDec.toFixed(2)}`,
      );
    }
    return true;
  }

  it('validates atomic double-entry split posting for net deposit + merchant fee = gross settlement', () => {
    const grossAmount = new Decimal('100.00');
    const feeAmount = new Decimal('3.00');
    const netDeposit = grossAmount.minus(feeAmount);

    expect(netDeposit.toFixed(2)).toBe('97.00');

    const journalLines = [
      {
        account: 'Operating Bank Account (1000)',
        debit: netDeposit.toNumber(),
        credit: 0,
        memo: 'Net settlement payout from Stripe',
      },
      {
        account: 'Merchant Processing Fee Expense (6100)',
        debit: feeAmount.toNumber(),
        credit: 0,
        memo: 'Payment processing fees',
      },
      {
        account: 'Undeposited Funds / Merchant Clearing (1050)',
        debit: 0,
        credit: grossAmount.toNumber(),
        memo: 'Gross batch settlement clearing',
      },
    ];

    expect(validateJournalBalance(journalLines)).toBe(true);
  });

  it('handles multi-transaction settlement batches with fractional processing fee splits', () => {
    const transactions = [
      { gross: '100.00', fee: '2.90', net: '97.10' },
      { gross: '50.00', fee: '1.45', net: '48.55' },
      { gross: '25.00', fee: '0.73', net: '24.27' },
    ];

    const totalGross = transactions.reduce(
      (sum, t) => sum.plus(new Decimal(t.gross)),
      new Decimal(0),
    );
    const totalFees = transactions.reduce(
      (sum, t) => sum.plus(new Decimal(t.fee)),
      new Decimal(0),
    );
    const totalNet = transactions.reduce(
      (sum, t) => sum.plus(new Decimal(t.net)),
      new Decimal(0),
    );

    expect(totalGross.toFixed(2)).toBe('175.00');
    expect(totalFees.toFixed(2)).toBe('5.08');
    expect(totalNet.toFixed(2)).toBe('169.92');

    const journalLines = [
      {
        account: 'Operating Bank Account',
        debit: totalNet.toNumber(),
        credit: 0,
      },
      {
        account: 'Merchant Processing Fee Expense',
        debit: totalFees.toNumber(),
        credit: 0,
      },
      {
        account: 'Merchant Clearing Account',
        debit: 0,
        credit: totalGross.toNumber(),
      },
    ];

    expect(validateJournalBalance(journalLines)).toBe(true);
  });

  it('rejects unbalanced settlement entry when fee rounding causes $0.01 mismatch', () => {
    const journalLines = [
      {
        account: 'Operating Bank Account',
        debit: 97.0,
        credit: 0,
      },
      {
        account: 'Merchant Processing Fee Expense',
        debit: 2.99, // Unbalanced fee! 97.00 + 2.99 = 99.99 != 100.00
        credit: 0,
      },
      {
        account: 'Merchant Clearing Account',
        debit: 0,
        credit: 100.0,
      },
    ];

    expect(() => validateJournalBalance(journalLines)).toThrow(
      'Journal entry is unbalanced: debit=99.99, credit=100.00',
    );
  });
});

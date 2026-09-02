import {
  calculateSalesInvoiceFinancials,
  buildReversalJournalLines,
  PureJournalLine,
} from './invoice-accounting';

describe('invoice-accounting (pure engine)', () => {
  describe('calculateSalesInvoiceFinancials', () => {
    it('calculates balanced journal lines for multi-line invoice with tax', () => {
      const result = calculateSalesInvoiceFinancials({
        invoiceNumber: 'INV-20260815-0001',
        arAccountCode: '1200',
        customerId: 'cust-123',
        currencyCode: 'AUD',
        exchangeRate: 1,
        lines: [
          {
            revenueAccountCode: '4000',
            netAmount: 100.0,
            taxAmount: 10.0,
            salesTaxAccountCode: '2200',
            description: 'Item Alpha',
          },
          {
            revenueAccountCode: '4010',
            netAmount: 50.0,
            taxAmount: 5.0,
            salesTaxAccountCode: '2200',
            description: 'Item Beta',
          },
        ],
      });

      expect(result.subtotal).toBe(150.0);
      expect(result.taxTotal).toBe(15.0);
      expect(result.grandTotal).toBe(165.0);
      expect(result.baseGrandTotal).toBe(165.0);

      // Verify zero-sum double-entry balance
      const totalDebits = result.journalLines.reduce((acc, l) => acc + l.debit, 0);
      const totalCredits = result.journalLines.reduce((acc, l) => acc + l.credit, 0);
      expect(Math.round(totalDebits * 100) / 100).toBe(Math.round(totalCredits * 100) / 100);
      expect(totalDebits).toBe(165.0);
    });

    it('calculates balanced multi-currency lines with foreign amounts', () => {
      const result = calculateSalesInvoiceFinancials({
        invoiceNumber: 'INV-20260815-0002',
        arAccountCode: '1200',
        customerId: 'cust-456',
        currencyCode: 'USD',
        exchangeRate: 1.5, // 1 USD = 1.5 AUD
        lines: [
          {
            revenueAccountCode: '4000',
            netAmount: 100.0,
            taxAmount: 0,
            description: 'Export item',
          },
        ],
      });

      expect(result.grandTotal).toBe(100.0); // Foreign
      expect(result.baseGrandTotal).toBe(150.0); // Base AUD

      const arLine = result.journalLines.find((l) => l.accountCode === '1200');
      expect(arLine?.debit).toBe(150.0);
      expect(arLine?.foreignDebit).toBe(100.0);

      const revLine = result.journalLines.find((l) => l.accountCode === '4000');
      expect(revLine?.credit).toBe(150.0);
      expect(revLine?.foreignCredit).toBe(100.0);
    });
  });

  describe('buildReversalJournalLines', () => {
    it('accurately inverts debits and credits while preserving metadata', () => {
      const originalLines: PureJournalLine[] = [
        {
          accountCode: '1200',
          debit: 110,
          credit: 0,
          partyType: 'customer',
          partyId: 'cust-1',
          memo: 'AR invoice',
        },
        {
          accountCode: '4000',
          debit: 0,
          credit: 100,
          memo: 'Revenue',
        },
        {
          accountCode: '2200',
          debit: 0,
          credit: 10,
          memo: 'Tax',
        },
      ];

      const reversed = buildReversalJournalLines(originalLines);

      expect(reversed[0].accountCode).toBe('1200');
      expect(reversed[0].debit).toBe(0);
      expect(reversed[0].credit).toBe(110);
      expect(reversed[0].partyId).toBe('cust-1');
      expect(reversed[0].memo).toBe('Cancellation Reversal: AR invoice');

      expect(reversed[1].accountCode).toBe('4000');
      expect(reversed[1].debit).toBe(100);
      expect(reversed[1].credit).toBe(0);

      expect(reversed[2].accountCode).toBe('2200');
      expect(reversed[2].debit).toBe(10);
      expect(reversed[2].credit).toBe(0);
    });
  });
});

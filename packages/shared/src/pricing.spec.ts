import {
  computeLinePrice,
  computeOrderTotals,
  computeReturnCreditSummary,
  getTaxLabel,
} from './pricing';

// ---------------------------------------------------------------------------
// computeLinePrice
// ---------------------------------------------------------------------------

describe('computeLinePrice', () => {
  it('calculates basic qty × price', () => {
    const result = computeLinePrice({ quantity: 5, pricePerUnit: 20 });
    expect(result.amount).toBe(100);
    expect(result.tax).toBe(0);
    expect(result.totalAmount).toBe(100);
  });

  it('applies discount percentage', () => {
    const result = computeLinePrice({
      quantity: 10,
      pricePerUnit: 50,
      discountPercentage: 10,
    });
    expect(result.amount).toBe(450); // 10 × 50 × 0.9
    expect(result.tax).toBe(0);
    expect(result.totalAmount).toBe(450);
  });

  it('applies tax rate', () => {
    const result = computeLinePrice({
      quantity: 1,
      pricePerUnit: 96.88,
      taxRate: 10,
    });
    expect(result.amount).toBe(96.88);
    expect(result.tax).toBe(9.69); // 96.88 × 0.10 = 9.688 → rounded to 9.69
    expect(result.totalAmount).toBe(106.57);
  });

  it('applies both discount and tax', () => {
    const result = computeLinePrice({
      quantity: 2,
      pricePerUnit: 100,
      discountPercentage: 20,
      taxRate: 10,
    });
    expect(result.amount).toBe(160); // 2 × 100 × 0.8
    expect(result.tax).toBe(16); // 160 × 0.10
    expect(result.totalAmount).toBe(176);
  });

  it('handles zero quantity', () => {
    const result = computeLinePrice({ quantity: 0, pricePerUnit: 50 });
    expect(result.amount).toBe(0);
    expect(result.tax).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  it('handles 100% discount', () => {
    const result = computeLinePrice({
      quantity: 5,
      pricePerUnit: 20,
      discountPercentage: 100,
      taxRate: 10,
    });
    expect(result.amount).toBe(0);
    expect(result.tax).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  it('rounds amounts to 2 decimal places', () => {
    // 3 × 33.33 = 99.99, tax = 99.99 × 0.10 = 9.999 → 10.00
    const result = computeLinePrice({
      quantity: 3,
      pricePerUnit: 33.33,
      taxRate: 10,
    });
    expect(result.amount).toBe(99.99);
    expect(result.tax).toBe(10);
    expect(result.totalAmount).toBe(109.99);
  });
});

// ---------------------------------------------------------------------------
// computeOrderTotals
// ---------------------------------------------------------------------------

describe('computeOrderTotals', () => {
  it('sums line amounts and taxes', () => {
    const result = computeOrderTotals([
      { amount: 100, tax: 10 },
      { amount: 200, tax: 20 },
    ]);
    expect(result.subtotal).toBe(300);
    expect(result.totalTax).toBe(30);
    expect(result.totalAmount).toBe(330);
  });

  it('handles string inputs', () => {
    const result = computeOrderTotals([
      { amount: '96.88', tax: '9.69' },
    ]);
    expect(result.subtotal).toBe(96.88);
    expect(result.totalTax).toBe(9.69);
    expect(result.totalAmount).toBe(106.57);
  });

  it('handles empty array', () => {
    const result = computeOrderTotals([]);
    expect(result.subtotal).toBe(0);
    expect(result.totalTax).toBe(0);
    expect(result.totalAmount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeReturnCreditSummary
// ---------------------------------------------------------------------------

describe('computeReturnCreditSummary', () => {
  it('calculates subtotal, tax, fees, and netCredit for a single line', () => {
    const result = computeReturnCreditSummary([
      {
        quantity: 1,
        pricePerUnit: 96.88,
        discountPercentage: 0,
        taxRate: 10,
        returnFee: 10,
      },
    ]);
    expect(result.subtotal).toBe(96.88);
    expect(result.totalTax).toBe(9.69); // 96.88 × 0.10 rounded
    expect(result.totalFees).toBe(10);
    expect(result.netCredit).toBe(96.57); // 96.88 + 9.69 - 10
  });

  it('aggregates multiple lines', () => {
    const result = computeReturnCreditSummary([
      { quantity: 2, pricePerUnit: 50, taxRate: 10, returnFee: 5 },
      { quantity: 1, pricePerUnit: 100, taxRate: 10, returnFee: 0 },
    ]);
    // Line 1: amount=100, tax=10, fee=5
    // Line 2: amount=100, tax=10, fee=0
    expect(result.subtotal).toBe(200);
    expect(result.totalTax).toBe(20);
    expect(result.totalFees).toBe(5);
    expect(result.netCredit).toBe(215); // 200 + 20 - 5
  });

  it('handles zero fees', () => {
    const result = computeReturnCreditSummary([
      { quantity: 1, pricePerUnit: 100, taxRate: 10 },
    ]);
    expect(result.subtotal).toBe(100);
    expect(result.totalTax).toBe(10);
    expect(result.totalFees).toBe(0);
    expect(result.netCredit).toBe(110); // 100 + 10 - 0
  });

  it('handles zero tax', () => {
    const result = computeReturnCreditSummary([
      { quantity: 5, pricePerUnit: 20, taxRate: 0, returnFee: 10 },
    ]);
    expect(result.subtotal).toBe(100);
    expect(result.totalTax).toBe(0);
    expect(result.totalFees).toBe(10);
    expect(result.netCredit).toBe(90);
  });

  it('applies discount correctly', () => {
    const result = computeReturnCreditSummary([
      {
        quantity: 2,
        pricePerUnit: 100,
        discountPercentage: 25,
        taxRate: 10,
        returnFee: 15,
      },
    ]);
    // amount = 2 × 100 × 0.75 = 150
    // tax = 150 × 0.10 = 15
    expect(result.subtotal).toBe(150);
    expect(result.totalTax).toBe(15);
    expect(result.totalFees).toBe(15);
    expect(result.netCredit).toBe(150); // 150 + 15 - 15
  });

  it('handles empty lines array', () => {
    const result = computeReturnCreditSummary([]);
    expect(result.subtotal).toBe(0);
    expect(result.totalTax).toBe(0);
    expect(result.totalFees).toBe(0);
    expect(result.netCredit).toBe(0);
  });

  it('rounds correctly with fractional amounts', () => {
    const result = computeReturnCreditSummary([
      { quantity: 3, pricePerUnit: 33.33, taxRate: 10, returnFee: 7.77 },
    ]);
    // amount = 3 × 33.33 = 99.99, tax = 99.99 × 0.10 = 9.999 → 10.00
    expect(result.subtotal).toBe(99.99);
    expect(result.totalTax).toBe(10);
    expect(result.totalFees).toBe(7.77);
    expect(result.netCredit).toBe(102.22); // 99.99 + 10.00 - 7.77
  });

  it('matches the invoice scenario from the UI bug', () => {
    // The exact scenario that was reported: A$96.88 item with 10% GST and $10 fee
    const result = computeReturnCreditSummary([
      { quantity: 1, pricePerUnit: 96.88, taxRate: 10, returnFee: 10 },
    ]);
    // Before fix: UI showed netCredit = 96.88 - 10 = 86.88 (missing tax)
    // After fix: netCredit = 96.88 + 9.69 - 10 = 96.57
    expect(result.netCredit).toBe(96.57);
  });
});

describe('getTaxLabel', () => {
  it('formats integer tax rate', () => {
    expect(getTaxLabel({ title: 'GST Standard', rate: '10' })).toBe('GST Standard (10%)');
  });

  it('formats fractional tax rate', () => {
    expect(getTaxLabel({ title: 'Reduced Rate', rate: '5.5' })).toBe('Reduced Rate (5.5%)');
  });

  it('falls back to code if title is missing', () => {
    expect(getTaxLabel({ code: 'GST_EXEMPT', rate: 0 })).toBe('GST_EXEMPT (0%)');
  });

  it('handles null/undefined category', () => {
    expect(getTaxLabel(null)).toBe('—');
  });
});


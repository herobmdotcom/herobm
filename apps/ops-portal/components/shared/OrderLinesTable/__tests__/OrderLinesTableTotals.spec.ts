import { computeLinePrice, computeOrderTotals, LineType, Decimal } from '@herobm/shared';

describe('Portal OrderLinesTable Totals & Optimistic Calculation Parity', () => {
  it('should compute exact order totals with Decimal precision matching backend verification', () => {
    const lines = [
      {
        lineNumber: 1,
        quantity: '3',
        pricePerUnit: '33.33',
        discountPercentage: '10',
        taxRate: 10,
        lineType: LineType.PRODUCT,
      },
      {
        lineNumber: 2,
        quantity: '7',
        pricePerUnit: '14.28',
        discountPercentage: '5',
        taxRate: 10,
        lineType: LineType.PRODUCT,
      },
    ];

    let totalDiscountDec = new Decimal(0);
    const mappedLines = lines.map((line) => {
      const qtyDec = new Decimal(line.quantity);
      const priceDec = new Decimal(line.pricePerUnit);
      const lineGross = qtyDec.mul(priceDec);

      const pricing = computeLinePrice({
        quantity: qtyDec.toNumber(),
        pricePerUnit: priceDec.toNumber(),
        discountPercentage: Number(line.discountPercentage),
        taxRate: line.taxRate,
      });

      const lineNet = new Decimal(pricing.amount);
      totalDiscountDec = totalDiscountDec.plus(lineGross.minus(lineNet));

      return {
        amount: pricing.amount,
        tax: pricing.tax,
      };
    });

    const totals = computeOrderTotals(mappedLines);

    // Line 1: 3 * 33.33 = 99.99 gross. 10% disc = 10.00. Net = 89.99. Tax = 9.00.
    // Line 2: 7 * 14.28 = 99.96 gross. 5% disc = 5.00. Net = 94.96. Tax = 9.50.
    // Subtotal: 89.99 + 94.96 = 184.95.
    // Total Tax: 9.00 + 9.50 = 18.50.
    // Total Amount: 203.45.
    expect(totals.subtotal).toBe(184.95);
    expect(totals.totalTax).toBe(18.50);
    expect(totals.totalAmount).toBe(203.45);
    expect(totalDiscountDec.toFixed(2)).toBe('15.00');
  });
});

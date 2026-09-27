import { Decimal } from 'decimal.js';
import { distributeLumpSum, distributeProRata } from '../pricing';

describe('Proration & Remainder Absorption (Largest Remainder Method)', () => {
  it('should split $100.00 evenly across 3 lines with zero lost cents ($33.33, $33.33, $33.34)', () => {
    const targets = [
      { item: { id: 'line-1' }, weight: 1 },
      { item: { id: 'line-2' }, weight: 1 },
      { item: { id: 'line-3' }, weight: 1 },
    ];

    const results = distributeLumpSum('100.00', targets, 2);

    expect(results).toHaveLength(3);
    const sum = results.reduce(
      (acc, r) => acc.plus(r.allocatedAmount),
      new Decimal(0),
    );

    // Strict invariant: Sum must exactly equal 100.00
    expect(sum.toFixed(2)).toBe('100.00');

    const amounts = results.map((r) => r.allocatedString);
    expect(amounts).toEqual(['33.34', '33.33', '33.33']);
  });

  it('should distribute uneven amounts across varying line totals without losing pennies', () => {
    // Total $50 discount across lines with values: $120.00, $250.00, $80.00 (Total value: $450)
    const targets = [
      { item: { id: 'line-1' }, weight: '120.00' },
      { item: { id: 'line-2' }, weight: '250.00' },
      { item: { id: 'line-3' }, weight: '80.00' },
    ];

    const results = distributeLumpSum('50.00', targets, 2);

    const sum = results.reduce(
      (acc, r) => acc.plus(r.allocatedAmount),
      new Decimal(0),
    );
    expect(sum.toFixed(2)).toBe('50.00');

    // 120/450 * 50 = 13.3333... -> 13.33
    // 250/450 * 50 = 27.7777... -> 27.78 (larger remainder)
    // 80/450 * 50  = 8.8888...  -> 8.89 (larger remainder)
    // 13.33 + 27.78 + 8.89 = 50.00
    expect(results[0].allocatedString).toBe('13.33');
    expect(results[1].allocatedString).toBe('27.78');
    expect(results[2].allocatedString).toBe('8.89');
  });

  it('should handle single line items without modification', () => {
    const targets = [{ item: { id: 'single' }, weight: 50 }];
    const results = distributeLumpSum('75.25', targets, 2);

    expect(results).toHaveLength(1);
    expect(results[0].allocatedString).toBe('75.25');
  });

  it('should handle zero total weight gracefully by distributing equally', () => {
    const targets = [
      { item: { id: 'line-1' }, weight: 0 },
      { item: { id: 'line-2' }, weight: 0 },
      { item: { id: 'line-3' }, weight: 0 },
    ];

    const results = distributeLumpSum('10.00', targets, 2);
    const sum = results.reduce(
      (acc, r) => acc.plus(r.allocatedAmount),
      new Decimal(0),
    );
    expect(sum.toFixed(2)).toBe('10.00');
  });

  it('should guarantee exact summation across 500 randomized distribution cases', () => {
    for (let iteration = 0; iteration < 500; iteration++) {
      const lineCount = Math.floor(Math.random() * 10) + 2; // 2 to 12 lines
      const totalAmount = (Math.random() * 10000 + 0.01).toFixed(2);
      const targets = Array.from({ length: lineCount }, (_, i) => ({
        item: { id: `line-${i}` },
        weight: (Math.random() * 500).toFixed(2),
      }));

      const results = distributeLumpSum(totalAmount, targets, 2);

      const sum = results.reduce(
        (acc, r) => acc.plus(r.allocatedAmount),
        new Decimal(0),
      );
      expect(sum.toFixed(2)).toBe(new Decimal(totalAmount).toFixed(2));
    }
  });

  it('distributeProRata helper should correctly adjust multi-line amounts by ratio', () => {
    const lines = [
      { id: '1', amount: '33.33', originalQty: 10, invoicedQty: 3 },
      { id: '2', amount: '66.67', originalQty: 10, invoicedQty: 3 },
    ];

    // Total original: 100.00. Invoiced portion is 30% = 30.00.
    const result = distributeProRata(
      '30.00',
      lines.map((l) => ({ item: l, weight: l.amount })),
      2,
    );

    const sum = result.reduce(
      (acc, r) => acc.plus(r.allocatedAmount),
      new Decimal(0),
    );
    expect(sum.toFixed(2)).toBe('30.00');
  });
});

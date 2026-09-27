import Decimal from 'decimal.js';
import { getAccountingStrategy } from '../inventory/inventory-accounting';
import type { InventoryGlAccounts } from '../inventory/inventory-accounting';

describe('Work Order Cost Capitalization & Absorption Invariants (Unit)', () => {
  const accts: InventoryGlAccounts = {
    inventoryAccountId: 'inv-asset-uuid',
    grniAccountId: 'grni-uuid',
    cogsAccountId: 'cogs-uuid',
    shrinkageAccountId: 'variance-uuid',
    apAccountId: 'ap-uuid',
    ppvAccountId: 'ppv-uuid',
  };

  const strategy = getAccountingStrategy('perpetual', accts);

  it('calculates total manufacturing build cost and unit capitalization with Decimal precision', () => {
    // 4 Finished Goods Units built from:
    // Component A: 2 EA * $3.50 = $7.00
    // Component B: 1.575 EA (with scrap yield) * $4.00 = $6.30
    // Assembly Labor: 4 * $2.50 = $10.00
    // Setup Overhead: $1.70
    const compA = new Decimal('2').mul('3.50');
    const compB = new Decimal('1.575').mul('4.00');
    const componentsCost = compA.plus(compB); // 7.00 + 6.30 = 13.30

    const targetQty = new Decimal('4');
    const assemblyLabor = new Decimal('2.50').mul(targetQty); // 10.00
    const setupOverhead = new Decimal('1.70');
    const laborAndOverhead = assemblyLabor.plus(setupOverhead); // 11.70

    const totalCost = componentsCost.plus(laborAndOverhead); // 25.00
    const unitCost = totalCost.div(targetQty); // 6.25

    expect(totalCost.toFixed(2)).toBe('25.00');
    expect(unitCost.toFixed(4)).toBe('6.2500');

    // Test Perpetual GL Generation
    const glResult = strategy.onWorkOrderCompletion({
      finishedGoodsValue: totalCost.toNumber(),
      componentsCost: componentsCost.toNumber(),
      laborAndOverheadCost: laborAndOverhead.toNumber(),
      memo: 'WO-1001 Completion',
    });

    expect(glResult).not.toBeNull();
    expect(glResult!.lines).toHaveLength(3);

    const fgLine = glResult!.lines.find((l) => l.debit > 0);
    expect(fgLine!.debit).toBe(25.0);

    const rawLine = glResult!.lines.find((l) =>
      l.memo.includes('Components consumed'),
    );
    expect(rawLine!.credit).toBe(13.3);

    const laborLine = glResult!.lines.find((l) =>
      l.memo.includes('Labor & overhead'),
    );
    expect(laborLine!.credit).toBe(11.7);

    const totalDebit = glResult!.lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = glResult!.lines.reduce(
      (s, l) => s + (l.credit || 0),
      0,
    );
    expect(totalDebit).toBe(totalCredit);
  });

  it('absorbs multi-line fractional rounding drift in GL journal lines so debits strictly equal credits', () => {
    // Scenario where components = $33.335 and labor = $66.665, total = $100.00
    const glResult = strategy.onWorkOrderCompletion({
      finishedGoodsValue: 100.0,
      componentsCost: 33.335,
      laborAndOverheadCost: 66.665,
      memo: 'Rounding Test WO',
    });

    expect(glResult).not.toBeNull();

    const totalDebit = glResult!.lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = glResult!.lines.reduce(
      (s, l) => s + (l.credit || 0),
      0,
    );

    expect(new Decimal(totalDebit).toFixed(2)).toBe(
      new Decimal(totalCredit).toFixed(2),
    );
    expect(totalDebit).toBe(100.0);
    expect(totalCredit).toBe(100.0);
  });
});

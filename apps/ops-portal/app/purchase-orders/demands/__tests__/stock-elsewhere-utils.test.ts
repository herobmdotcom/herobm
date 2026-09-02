import { computeStockElsewhereDisplay } from '../stock-elsewhere-utils';

describe('computeStockElsewhereDisplay', () => {
  it('returns an empty cell when there is no other stock', () => {
    const result = computeStockElsewhereDisplay([], 10);
    expect(result).toEqual({ label: '', overflow: 0, signal: 'empty', best: null });
  });

  it('handles null/undefined input safely', () => {
    expect(computeStockElsewhereDisplay(null, 10).signal).toBe('empty');
    expect(computeStockElsewhereDisplay(undefined, 10).signal).toBe('empty');
  });

  it('picks the location with the highest available qty', () => {
    const result = computeStockElsewhereDisplay(
      [
        { locationId: 'a', locationName: 'A', availableQty: 3 },
        { locationId: 'b', locationName: 'B', availableQty: 12 },
        { locationId: 'c', locationName: 'C', availableQty: 7 },
      ],
      10,
    );
    expect(result.best?.locationId).toBe('b');
    expect(result.label).toBe('12 @ B');
  });

  it('counts overflow when more than one other location has stock', () => {
    const result = computeStockElsewhereDisplay(
      [
        { locationId: 'a', locationName: 'A', availableQty: 3 },
        { locationId: 'b', locationName: 'B', availableQty: 12 },
        { locationId: 'c', locationName: 'C', availableQty: 7 },
      ],
      10,
    );
    expect(result.overflow).toBe(2);
  });

  it('reports zero overflow when there is exactly one other location', () => {
    const result = computeStockElsewhereDisplay(
      [{ locationId: 'b', locationName: 'B', availableQty: 12 }],
      10,
    );
    expect(result.overflow).toBe(0);
  });

  it('signals green when the single best location fully covers the demand', () => {
    const result = computeStockElsewhereDisplay(
      [{ locationId: 'b', locationName: 'B', availableQty: 12 }],
      10,
    );
    expect(result.signal).toBe('green');
  });

  it('signals amber when the single best location only partially covers the demand', () => {
    const result = computeStockElsewhereDisplay(
      [{ locationId: 'b', locationName: 'B', availableQty: 4 }],
      10,
    );
    expect(result.signal).toBe('amber');
  });

  it('does not aggregate stock across locations for the colour signal', () => {
    // Combined qty (4 + 4 + 4 = 12) >= 10, but no single location covers
    // on its own, so the signal must still be amber.
    const result = computeStockElsewhereDisplay(
      [
        { locationId: 'a', locationName: 'A', availableQty: 4 },
        { locationId: 'b', locationName: 'B', availableQty: 4 },
        { locationId: 'c', locationName: 'C', availableQty: 4 },
      ],
      10,
    );
    expect(result.signal).toBe('amber');
  });

  it('formats fractional quantities to at most two decimals', () => {
    const result = computeStockElsewhereDisplay(
      [{ locationId: 'b', locationName: 'B', availableQty: 12.5 }],
      10,
    );
    expect(result.label).toBe('12.5 @ B');
  });
});

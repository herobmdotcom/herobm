import { buildReallocateLocationOptions } from '../reallocate-utils';

describe('buildReallocateLocationOptions', () => {
  const locations = [
    { locationId: 'a', code: 'WH-A', name: 'Warehouse A' },
    { locationId: 'b', code: 'WH-B', name: 'Warehouse B' },
    { locationId: 'c', code: 'WH-C', name: 'Warehouse C' },
  ];

  it('shows zero-stock locations rather than hiding them', () => {
    const options = buildReallocateLocationOptions(locations, [
      { locationId: 'b', locationName: 'Warehouse B', availableQty: 12 },
    ]);
    expect(options).toHaveLength(3);
    const c = options.find((o) => o.locationId === 'c');
    expect(c?.availableQty).toBe(0);
    expect(c?.label).toContain('0 available');
  });

  it('uses "available" framing (destination, not source)', () => {
    const options = buildReallocateLocationOptions(locations, [
      { locationId: 'b', locationName: 'Warehouse B', availableQty: 12 },
    ]);
    expect(options.find((o) => o.locationId === 'b')?.label).toBe(
      'WH-B - Warehouse B - 12 available',
    );
    // Negative: never "to transfer" — this would imply source framing
    for (const opt of options) {
      expect(opt.label).not.toMatch(/to transfer/i);
    }
  });

  it('includes the code prefix only when present', () => {
    const options = buildReallocateLocationOptions(
      [{ locationId: 'a', name: 'Just Name' }],
      [],
    );
    expect(options[0].label).toBe('Just Name - 0 available');
  });

  it('handles empty location list', () => {
    expect(buildReallocateLocationOptions([], [])).toEqual([]);
  });
});

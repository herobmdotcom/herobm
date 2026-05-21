import { buildInternalTransferSourceOptions } from '../internal-transfer-utils';

describe('buildInternalTransferSourceOptions', () => {
  const locations = [
    { locationId: 'a', code: 'WH-A', name: 'Warehouse A', availableQty: 0 },
    { locationId: 'b', code: 'WH-B', name: 'Warehouse B', availableQty: 12 },
    { locationId: 'c', code: 'WH-C', name: 'Warehouse C', availableQty: 3 },
  ];

  it('excludes the destination location from the source dropdown', () => {
    const options = buildInternalTransferSourceOptions(locations, 'b');
    const ids = options.map((o) => o.locationId).sort();
    expect(ids).toEqual(['a', 'c']);
  });

  it('keeps zero-stock locations in the list (not disabled, with qty shown)', () => {
    const options = buildInternalTransferSourceOptions(locations, 'b');
    const a = options.find((o) => o.locationId === 'a');
    expect(a).toBeDefined();
    expect(a?.availableQty).toBe(0);
    expect(a?.label).toBe('Warehouse A - 0 available');
  });

  it('formats labels as "<name> - <qty> available"', () => {
    const options = buildInternalTransferSourceOptions(locations, 'a');
    const b = options.find((o) => o.locationId === 'b');
    expect(b?.label).toBe('Warehouse B - 12 available');
  });

  it('defaults to qty 0 when availability data is not supplied', () => {
    const options = buildInternalTransferSourceOptions(
      [{ locationId: 'x', name: 'Loc X' }],
      undefined,
    );
    expect(options[0].availableQty).toBe(0);
    expect(options[0].label).toBe('Loc X - 0 available');
  });
});

import { calculateInventoryGaps, OrderLineMinimal, InventoryLevelMinimal } from './inventory';

describe('Inventory Logic (Shared)', () => {
  const p1 = 'prod-1';
  const loc1 = 'loc-1';
  const loc2 = 'loc-2';

  it('should handle numeric values as strings (Drizzle compatibility)', () => {
    const lines: OrderLineMinimal[] = [
      { salesOrderLineId: 'l1', productId: p1, productDescription: 'p1', quantity: '23', fulfillmentLocationId: loc1, productType: 'inventory' }
    ];
    // This replicates the bug we found: "0" - "184" coming back as strings
    const levels: InventoryLevelMinimal[] = [
      { productId: p1, locationId: loc1, quantityAvailable: '0' },
      { productId: p1, locationId: loc1, quantityAvailable: '-184' }
    ];

    const gaps = calculateInventoryGaps(lines, levels);
    
    expect(gaps).toHaveLength(1);
    expect(gaps[0].shortage).toBe(207); // 23 - (-184) = 207
  });

  it('should handle location fallback from header', () => {
    const lines: OrderLineMinimal[] = [
      { salesOrderLineId: 'l1', productId: p1, productDescription: 'p1', quantity: 10, fulfillmentLocationId: null, productType: 'inventory' }
    ];
    const levels: InventoryLevelMinimal[] = [
      { productId: p1, locationId: loc2, quantityAvailable: 5 }
    ];

    // Case 1: Header matches location
    const gapsMatch = calculateInventoryGaps(lines, levels, loc2);
    expect(gapsMatch[0].shortage).toBe(5);

    // Case 2: Header does not match location
    const gapsNoMatch = calculateInventoryGaps(lines, levels, loc1);
    expect(gapsNoMatch[0].availableQuantity).toBe(0);
    expect(gapsNoMatch[0].shortage).toBe(10);
  });

  it('should ignore non-stock and service products', () => {
    const lines: OrderLineMinimal[] = [
      { salesOrderLineId: 'l1', productId: p1, productDescription: 'p1', quantity: 10, productType: 'service' },
      { salesOrderLineId: 'l2', productId: p1, productDescription: 'p1', quantity: 10, productType: 'non-stock' }
    ];
    const levels: InventoryLevelMinimal[] = [
      { productId: p1, locationId: loc1, quantityAvailable: 0 }
    ];

    const gaps = calculateInventoryGaps(lines, levels, loc1);
    expect(gaps).toHaveLength(0);
  });
});

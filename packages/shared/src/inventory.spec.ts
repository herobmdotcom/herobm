import {
  calculateInventoryGaps,
  OrderLineMinimal,
  InventoryLevelMinimal,
  isStockedProductLine,
  isPhysicalProductLine,
  isShippableProductLine,
} from './inventory';

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
    expect(gaps[0].shortage).toBe(23); // shortage should be clamped to ordered quantity (23) rather than adding negative availability
  });

  it('should clamp negative available inventory so it does not over-inflate demand', () => {
    const lines: OrderLineMinimal[] = [
      { salesOrderLineId: 'l1', productId: p1, productDescription: 'p1', quantity: 5, fulfillmentLocationId: loc1, productType: 'inventory' }
    ];
    const levels: InventoryLevelMinimal[] = [
      { productId: p1, locationId: loc1, quantityAvailable: -60 }
    ];

    const gaps = calculateInventoryGaps(lines, levels);
    
    expect(gaps).toHaveLength(1);
    expect(gaps[0].shortage).toBe(5); // Not 65!
    expect(gaps[0].availableQuantity).toBe(-60); // Verify it retains original available context
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

  it('should distinguish between stocked, physical, and shippable products', () => {
    // Inventory: stocked + physical + shippable
    expect(isStockedProductLine({ productId: p1, productType: 'inventory' })).toBe(true);
    expect(isPhysicalProductLine({ productId: p1, productType: 'inventory' })).toBe(true);
    expect(isShippableProductLine({ productId: p1, productType: 'inventory' })).toBe(true);

    // Non-stock: NOT stocked, but physical + shippable
    expect(isStockedProductLine({ productId: p1, productType: 'non-stock' })).toBe(false);
    expect(isPhysicalProductLine({ productId: p1, productType: 'non-stock' })).toBe(true);
    expect(isShippableProductLine({ productId: p1, productType: 'non-stock' })).toBe(true);

    // Service: NOT stocked, NOT physical, NOT shippable
    expect(isStockedProductLine({ productId: p1, productType: 'service' })).toBe(false);
    expect(isPhysicalProductLine({ productId: p1, productType: 'service' })).toBe(false);
    expect(isShippableProductLine({ productId: p1, productType: 'service' })).toBe(false);

    // Freight: NOT stocked, NOT physical, NOT shippable
    expect(isStockedProductLine({ productId: p1, productType: 'freight' })).toBe(false);
    expect(isPhysicalProductLine({ productId: p1, productType: 'freight' })).toBe(false);
    expect(isShippableProductLine({ productId: p1, productType: 'freight' })).toBe(false);

    // Custom lines (no productId): NOT stocked in warehouse bins, but physical + shippable
    expect(isStockedProductLine({ productId: null })).toBe(false);
    expect(isPhysicalProductLine({ productId: null })).toBe(true);
    expect(isShippableProductLine({ productId: null })).toBe(true);
  });
});

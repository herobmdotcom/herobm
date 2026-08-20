import {
  calculateInventoryGaps,
  OrderLineMinimal,
  InventoryLevelMinimal,
  isStockedProductLine,
  isPhysicalProductLine,
  isShippableProductLine,
  formatPickBarcode,
  parsePickBarcode,
  formatQuantity,
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

  it('should sequentially deduct available stock when multiple lines order the same product', () => {
    const lines: OrderLineMinimal[] = [
      { salesOrderLineId: 'line-1', productId: p1, productDescription: 'Part 1', quantity: 6, fulfillmentLocationId: loc1, productType: 'inventory' },
      { salesOrderLineId: 'line-2', productId: p1, productDescription: 'Part 1', quantity: 6, fulfillmentLocationId: loc1, productType: 'inventory' },
    ];
    const levels: InventoryLevelMinimal[] = [
      { productId: p1, locationId: loc1, quantityAvailable: 10 },
    ];

    const gaps = calculateInventoryGaps(lines, levels);

    // Line 1 uses 6 of 10 available -> 4 remaining. No gap for Line 1.
    // Line 2 needs 6, only 4 remaining -> Shortage of 2 for Line 2.
    expect(gaps).toHaveLength(1);
    expect(gaps[0].salesOrderLineId).toBe('line-2');
    expect(gaps[0].orderedQuantity).toBe(6);
    expect(gaps[0].availableQuantity).toBe(4);
    expect(gaps[0].shortage).toBe(2);
  });

  it('should not create gaps for legacy custom lines', () => {
    const lines: OrderLineMinimal[] = [
      { salesOrderLineId: 'line-custom-1', productId: '00000000-0000-0000-0000-000000000000', productDescription: 'Custom Item 1', quantity: 10, fulfillmentLocationId: loc1 },
      { salesOrderLineId: 'line-custom-2', productId: '00000000-0000-4000-8000-000000000000', productDescription: 'Custom Item 2', quantity: 10, fulfillmentLocationId: loc1 },
    ];
    const levels: InventoryLevelMinimal[] = [];

    const gaps = calculateInventoryGaps(lines, levels);
    expect(gaps).toHaveLength(0);
  });

  describe('Scan-to-Pick Barcode Formatter & Parser', () => {
    it('should format a valid pick barcode string', () => {
      const payload = {
        orderId: 'ord-123',
        lineId: 'line-456',
        binId: 'bin-789',
        quantity: '5',
      };
      expect(formatPickBarcode(payload)).toBe('PICK:ord-123:line-456:bin-789:5');
    });

    it('should parse a standard PICK: prefixed barcode string', () => {
      const barcode = 'PICK:ord-123:line-456:bin-789:5';
      const parsed = parsePickBarcode(barcode);
      expect(parsed).toEqual({
        orderId: 'ord-123',
        lineId: 'line-456',
        binId: 'bin-789',
        quantity: '5',
      });
    });

    it('should parse a raw barcode string without PICK: prefix', () => {
      const barcode = 'ord-123:line-456:bin-789:3';
      const parsed = parsePickBarcode(barcode);
      expect(parsed).toEqual({
        orderId: 'ord-123',
        lineId: 'line-456',
        binId: 'bin-789',
        quantity: '3',
      });
    });

    it('should return null for invalid or incomplete barcode strings', () => {
      expect(parsePickBarcode('')).toBeNull();
      expect(parsePickBarcode('   ')).toBeNull();
      expect(parsePickBarcode('PICK:ord-123:line-456')).toBeNull();
      expect(parsePickBarcode('INVALID')).toBeNull();
    });
  });

  describe('formatQuantity', () => {
    it('should format whole numbers without decimals', () => {
      expect(formatQuantity(0)).toBe('0');
      expect(formatQuantity(10)).toBe('10');
      expect(formatQuantity('25')).toBe('25');
      expect(formatQuantity(1000, 4, 'en-US')).toBe('1,000');
    });

    it('should format fractional numbers with natural decimals', () => {
      expect(formatQuantity(9.93, 4, 'en-US')).toBe('9.93');
      expect(formatQuantity('9.9300', 4, 'en-US')).toBe('9.93');
      expect(formatQuantity(0.5, 4, 'en-US')).toBe('0.5');
      expect(formatQuantity(1234.5678, 4, 'en-US')).toBe('1,234.5678');
      expect(formatQuantity(1234.56789, 4, 'en-US')).toBe('1,234.5679');
    });

    it('should handle negative numbers correctly', () => {
      expect(formatQuantity(-3, 4, 'en-US')).toBe('-3');
      expect(formatQuantity('-15.75', 4, 'en-US')).toBe('-15.75');
    });

    it('should fallback to 0 for null/undefined/empty/invalid input', () => {
      expect(formatQuantity(null)).toBe('0');
      expect(formatQuantity(undefined)).toBe('0');
      expect(formatQuantity('')).toBe('0');
      expect(formatQuantity('abc')).toBe('0');
    });
  });
});

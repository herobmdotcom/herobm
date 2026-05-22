import {
  getAccountingStrategy,
  GlPostingContext,
  InventoryGlAccounts,
} from './inventory-accounting';

describe('PerpetualAccountingStrategy', () => {
  const accts: InventoryGlAccounts = {
    inventoryAccountId: 'inv-uuid',
    grniAccountId: 'grni-uuid',
    cogsAccountId: 'cogs-uuid',
    shrinkageAccountId: 'shrink-uuid',
  };

  const strategy = getAccountingStrategy('perpetual', accts);

  const ctx: GlPostingContext = {
    amount: 125.5,
    memo: 'Test Dimension Propagation',
    costCenterId: 'cc-123',
    activityId: 'act-456',
    partyType: 'supplier',
    partyId: 'supp-1',
  };

  it('should propagate dimensions in onGoodsReceipt', () => {
    const res = strategy.onGoodsReceipt(ctx);
    expect(res).not.toBeNull();
    expect(res!.lines).toHaveLength(2);
    res!.lines.forEach((line) => {
      expect(line.costCenterId).toBe('cc-123');
      expect(line.activityId).toBe('act-456');
    });
    // Check specific line tagging
    const grniLine = res!.lines.find((l) => l.customerId === 'grni-uuid');
    expect(grniLine!.partyType).toBe('supplier');
    expect(grniLine!.partyId).toBe('supp-1');
  });

  it('should propagate dimensions in onGoodsDispatch', () => {
    const res = strategy.onGoodsDispatch(ctx);
    expect(res).not.toBeNull();
    expect(res!.lines).toHaveLength(2);
    res!.lines.forEach((line) => {
      expect(line.costCenterId).toBe('cc-123');
      expect(line.activityId).toBe('act-456');
    });
  });

  it('should propagate dimensions in onDispatchReversal', () => {
    const res = strategy.onDispatchReversal(ctx);
    expect(res).not.toBeNull();
    res!.lines.forEach((line) => {
      expect(line.costCenterId).toBe('cc-123');
      expect(line.activityId).toBe('act-456');
    });
  });

  it('should propagate dimensions in onManualAdjustment', () => {
    const res = strategy.onManualAdjustment(ctx, 'loss');
    expect(res).not.toBeNull();
    res!.lines.forEach((line) => {
      expect(line.costCenterId).toBe('cc-123');
      expect(line.activityId).toBe('act-456');
    });
  });

  it('should propagate dimensions in onSalesReturn', () => {
    const res = strategy.onSalesReturn(ctx);
    expect(res).not.toBeNull();
    res!.lines.forEach((line) => {
      expect(line.costCenterId).toBe('cc-123');
      expect(line.activityId).toBe('act-456');
    });
  });

  it('should propagate dimensions in onSupplierReturn', () => {
    const res = strategy.onSupplierReturn(ctx);
    expect(res).not.toBeNull();
    res!.lines.forEach((line) => {
      expect(line.costCenterId).toBe('cc-123');
      expect(line.activityId).toBe('act-456');
    });
  });
});

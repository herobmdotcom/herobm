import {
  autoShipWhenFullyShipped,
  revertToPickingOnShipmentCancel,
  evaluateLifecycleRules,
  LifecycleTrigger,
} from './order-lifecycle-rules';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockDb(
  orderState: string,
  lines: Array<{ id: string; qty: string }>,
  shipped: Map<string, number>,
) {
  const mockTx: any = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest
          .fn()
          .mockReturnValue(
            lines.map((l) => ({ salesOrderLineId: l.id, quantity: l.qty })),
          ),
      }),
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    }),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    }),
  };

  return mockTx;
}

// Since getShippedPerLine and findOrder are imported from shipment-helpers,
// we mock that module globally for the test.
jest.mock('./shipment-helpers', () => ({
  findOrder: jest.fn(),
  getShippedPerLine: jest.fn(),
  writeEvent: jest.fn().mockResolvedValue(undefined),
}));

import { findOrder, getShippedPerLine, writeEvent } from './shipment-helpers';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Order Lifecycle Rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('autoShipWhenFullyShipped', () => {
    const trigger: LifecycleTrigger = {
      entity: 'shipment',
      id: 'shp-1',
      action: 'dispatched',
    };

    it('should transition order to shipped when all lines are fully shipped', async () => {
      (findOrder as jest.Mock).mockResolvedValue({ stateCode: 'picking' });
      (getShippedPerLine as jest.Mock).mockResolvedValue(
        new Map([
          ['line1', 10],
          ['line2', 5],
        ]),
      );

      const db = createMockDb(
        'picking',
        [
          { id: 'line1', qty: '10' },
          { id: 'line2', qty: '5' },
        ],
        new Map(), // not used directly by our mock db setup
      );

      const result = await autoShipWhenFullyShipped.evaluate(
        db,
        'order-1',
        trigger,
        'admin',
      );

      expect(result).toBeDefined();
      expect(result?.to).toBe('shipped');
      expect(db.update).toHaveBeenCalled();
      expect(writeEvent).toHaveBeenCalledWith(
        db,
        'order-1',
        'auto_status_changed',
        expect.objectContaining({ to: 'shipped' }),
        'admin',
      );
    });

    it('should do nothing if an order line is only partially shipped', async () => {
      (findOrder as jest.Mock).mockResolvedValue({ stateCode: 'picking' });
      (getShippedPerLine as jest.Mock).mockResolvedValue(
        new Map([
          ['line1', 10],
          ['line2', 2],
        ]), // line2 is short
      );

      const db = createMockDb(
        'picking',
        [
          { id: 'line1', qty: '10' },
          { id: 'line2', qty: '5' },
        ],
        new Map(),
      );

      const result = await autoShipWhenFullyShipped.evaluate(
        db,
        'order-1',
        trigger,
        'admin',
      );

      expect(result).toBeNull();
      expect(db.update).not.toHaveBeenCalled();
    });

    it('should do nothing if order is not in picking state', async () => {
      (findOrder as jest.Mock).mockResolvedValue({ stateCode: 'draft' });

      const db = createMockDb('draft', [], new Map());
      const result = await autoShipWhenFullyShipped.evaluate(
        db,
        'order-1',
        trigger,
        'admin',
      );

      expect(result).toBeNull();
    });

    it('should do nothing if triggered by non-dispatched action', async () => {
      const db = createMockDb('picking', [], new Map());
      const result = await autoShipWhenFullyShipped.evaluate(
        db,
        'order-1',
        { entity: 'shipment', id: 'shp-1', action: 'draft' },
        'admin',
      );
      expect(result).toBeNull();
    });
  });

  describe('revertToPickingOnShipmentCancel', () => {
    const trigger: LifecycleTrigger = {
      entity: 'shipment',
      id: 'shp-1',
      action: 'cancelled',
    };

    it('should transition order to picking when lines are no longer fully shipped', async () => {
      (findOrder as jest.Mock).mockResolvedValue({ stateCode: 'shipped' });
      // Total shipped after cancellation: line1 is full, line2 has 0
      (getShippedPerLine as jest.Mock).mockResolvedValue(
        new Map([
          ['line1', 10],
          ['line2', 0],
        ]),
      );

      const db = createMockDb(
        'shipped',
        [
          { id: 'line1', qty: '10' },
          { id: 'line2', qty: '5' },
        ],
        new Map(),
      );

      const result = await revertToPickingOnShipmentCancel.evaluate(
        db,
        'order-1',
        trigger,
        'admin',
      );

      expect(result).toBeDefined();
      expect(result?.to).toBe('picking');
      expect(db.update).toHaveBeenCalled();
      expect(writeEvent).toHaveBeenCalledWith(
        db,
        'order-1',
        'auto_status_changed',
        expect.objectContaining({ to: 'picking' }),
        'admin',
      );
    });

    it('should do nothing if order remains fully shipped (e.g. over-shipped or zero qty cancelled)', async () => {
      (findOrder as jest.Mock).mockResolvedValue({ stateCode: 'shipped' });
      (getShippedPerLine as jest.Mock).mockResolvedValue(
        new Map([
          ['line1', 10],
          ['line2', 5],
        ]), // still fully covered
      );

      const db = createMockDb(
        'shipped',
        [
          { id: 'line1', qty: '10' },
          { id: 'line2', qty: '5' },
        ],
        new Map(),
      );

      const result = await revertToPickingOnShipmentCancel.evaluate(
        db,
        'order-1',
        trigger,
        'admin',
      );

      expect(result).toBeNull();
      expect(db.update).not.toHaveBeenCalled();
    });

    it('should do nothing if triggered by non-cancel/draft action', async () => {
      const db = createMockDb('shipped', [], new Map());
      const result = await revertToPickingOnShipmentCancel.evaluate(
        db,
        'order-1',
        { entity: 'shipment', id: 'shp-1', action: 'dispatched' },
        'admin',
      );
      expect(result).toBeNull();
    });
  });

  describe('evaluateLifecycleRules', () => {
    it('should run rules and return transitions', async () => {
      (findOrder as jest.Mock).mockResolvedValue({ stateCode: 'picking' });
      (getShippedPerLine as jest.Mock).mockResolvedValue(
        new Map([['line1', 10]]),
      );

      const db = createMockDb(
        'picking',
        [{ id: 'line1', qty: '10' }],
        new Map(),
      );

      const transitions = await evaluateLifecycleRules(
        db,
        'order-1',
        { entity: 'shipment', id: 'shp-1', action: 'dispatched' },
        'admin',
      );

      expect(transitions).toHaveLength(1);
      expect(transitions[0].ruleName).toBe('auto-ship-when-fully-shipped');
    });
  });
});

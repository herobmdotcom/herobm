import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pollOutbox, processEvent } from './relay.service';
import { Job } from 'bullmq';

describe('relay.service', () => {
  describe('pollOutbox', () => {
    let mockDb: any;
    let mockQueue: any;
    let pendingEvents: any[];

    beforeEach(() => {
      pendingEvents = [
        { id: 1, type: 'goods_received', payload: { foo: 'bar' } },
        { id: 2, type: 'goods_dispatched', payload: { baz: 'qux' } }
      ];

      mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(pendingEvents),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis()
      };

      mockQueue = {
        add: vi.fn().mockResolvedValue(true)
      };
    });

    it('should poll pending events and enqueue them', async () => {
      await pollOutbox(mockDb, mockQueue);

      // Verify jobs were queued
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      expect(mockQueue.add).toHaveBeenNthCalledWith(
        1,
        'process-event',
        { eventId: 1, type: 'goods_received', payload: { foo: 'bar' } },
        { jobId: 1, removeOnComplete: true }
      );

      // Verify DB was updated
      expect(mockDb.update).toHaveBeenCalledTimes(2);
    });

    it('should handle empty result gracefully', async () => {
      mockDb.limit.mockResolvedValue([]);
      await pollOutbox(mockDb, mockQueue);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('processEvent', () => {
    let mockErpClient: any;

    beforeEach(() => {
      mockErpClient = {
        createJournalEntry: vi.fn().mockResolvedValue(true)
      };
    });

    const createJob = (type: string, payload: any): Job => {
      return {
        data: { eventId: 1, type, payload }
      } as unknown as Job;
    };

    it('should create JE for goods_received with value', async () => {
      const job = createJob('goods_received', {
        receptionNumber: 'REC-001',
        inventoryValueAdded: '100',
        purchasePriceVariance: '0'
      });

      await processEvent(job, mockErpClient);

      expect(mockErpClient.createJournalEntry).toHaveBeenCalledTimes(1);
      const args = mockErpClient.createJournalEntry.mock.calls[0][0];
      
      expect(args.title).toBe('Goods Receipt REC-001');
      expect(args.accounts).toHaveLength(2);
      expect(args.accounts[0]).toEqual({
         account: 'Inventory',
         debit_in_account_currency: 100,
         credit_in_account_currency: 0
      });
      expect(args.accounts[1]).toEqual({
         account: 'Goods Received Not Invoiced',
         debit_in_account_currency: 0,
         credit_in_account_currency: 100
      });
    });

    it('should skip goods_received if value is zero', async () => {
      const job = createJob('goods_received', {
        receptionNumber: 'REC-002',
        inventoryValueAdded: '0',
        purchasePriceVariance: '0'
      });

      await processEvent(job, mockErpClient);
      expect(mockErpClient.createJournalEntry).not.toHaveBeenCalled();
    });

    it('should create JE for goods_received with positive variance', async () => {
      const job = createJob('goods_received', {
        receptionNumber: 'REC-003',
        inventoryValueAdded: '0',
        purchasePriceVariance: '25.50'
      });

      await processEvent(job, mockErpClient);
      
      const args = mockErpClient.createJournalEntry.mock.calls[0][0];
      expect(args.accounts).toHaveLength(2);
      // Debit COGS, Credit GRNI
      expect(args.accounts[0]).toMatchObject({ account: 'Cost of Goods Sold', debit_in_account_currency: 25.5 });
      expect(args.accounts[1]).toMatchObject({ account: 'Goods Received Not Invoiced', credit_in_account_currency: 25.5 });
    });

    it('should create JE for goods_received with negative variance', async () => {
      const job = createJob('goods_received', {
        receptionNumber: 'REC-004',
        inventoryValueAdded: '0',
        purchasePriceVariance: '-10'
      });

      await processEvent(job, mockErpClient);
      
      const args = mockErpClient.createJournalEntry.mock.calls[0][0];
      // Credit COGS, Debit GRNI
      expect(args.accounts[0]).toMatchObject({ account: 'Cost of Goods Sold', credit_in_account_currency: 10 });
      expect(args.accounts[1]).toMatchObject({ account: 'Goods Received Not Invoiced', debit_in_account_currency: 10 });
    });

    it('should create JE for goods_dispatched with cogs', async () => {
      const job = createJob('goods_dispatched', {
        shipmentNumber: 'SHIP-001',
        cogsDetails: [
          { cogsAmount: '50' },
          { cogsAmount: '120.5' }
        ]
      });

      await processEvent(job, mockErpClient);

      expect(mockErpClient.createJournalEntry).toHaveBeenCalledTimes(1);
      const args = mockErpClient.createJournalEntry.mock.calls[0][0];
      
      expect(args.title).toBe('Goods Dispatched SHIP-001');
      expect(args.accounts).toHaveLength(2);
      expect(args.accounts[0]).toEqual({
         account: 'Cost of Goods Sold',
         debit_in_account_currency: 170.5,
         credit_in_account_currency: 0
      });
      expect(args.accounts[1]).toEqual({
         account: 'Inventory',
         debit_in_account_currency: 0,
         credit_in_account_currency: 170.5
      });
    });

    it('should skip goods_dispatched if cogs is zero', async () => {
      const job = createJob('goods_dispatched', {
        shipmentNumber: 'SHIP-002',
        cogsDetails: []
      });

      await processEvent(job, mockErpClient);
      expect(mockErpClient.createJournalEntry).not.toHaveBeenCalled();
    });
  });
});

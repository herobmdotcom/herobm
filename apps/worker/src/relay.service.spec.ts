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
        { id: 1, type: 'sales_invoiced', payload: { foo: 'bar' } },
        { id: 2, type: 'purchase_invoiced', payload: { baz: 'qux' } }
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
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      expect(mockDb.update).toHaveBeenCalledTimes(2);
      expect(mockDb.set).toHaveBeenCalledWith({ lockedUntil: expect.any(Date) });
    });

    it('should handle empty result gracefully', async () => {
      mockDb.limit.mockResolvedValue([]);
      await pollOutbox(mockDb, mockQueue);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('processEvent', () => {
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([])
      };
    });

    const createJob = (type: string, payload: any): Job => {
      return {
        data: { 
          eventId: 1, 
          type, 
          aggregateId: 'agg-1',
          aggregateType: 'sales_order',
          createdOn: new Date('2026-06-02T12:00:00Z'),
          payload 
        }
      } as unknown as Job;
    };



    describe('Webhooks', () => {
      let fetchSpy: any;

      beforeEach(() => {
        fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
          ok: true,
          status: 200,
        } as Response);

        mockDb.select = vi.fn().mockReturnThis();
        mockDb.from = vi.fn().mockReturnThis();
        mockDb.where = vi.fn().mockResolvedValue([
          { webhookId: 'wh-1', targetUrl: 'https://webhook.site/1', secretKey: 'secret-123', isActive: true, eventTypes: ['sales_order.created'] },
          { webhookId: 'wh-2', targetUrl: 'https://webhook.site/2', secretKey: 'secret-456', isActive: true, eventTypes: ['*'] }
        ]);
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('should dispatch to all active webhooks subscribed to the exact event type and wildcard', async () => {
        const job = createJob('sales_order.created', { orderId: 'SO-1' });
        await processEvent(job, mockDb);

        // Expect fetch to be called twice (once for wh-1, once for wh-2)
        expect(fetchSpy).toHaveBeenCalledTimes(2);

        // Verify headers and signature
        expect(fetchSpy).toHaveBeenCalledWith('https://webhook.site/1', expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-herobm-signature': expect.any(String)
          }),
          body: expect.any(String)
        }));

        expect(fetchSpy).toHaveBeenCalledWith('https://webhook.site/2', expect.any(Object));

        // Expect terminal success
        expect(mockDb.update).toHaveBeenCalledTimes(1); // the outbox terminal success
        expect(mockDb.set).toHaveBeenCalledWith({ processedAt: expect.any(Date), lockedUntil: null });
      });

      it('should gracefully handle and log HTTP 500 errors from webhooks without failing the event', async () => {
        fetchSpy.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
        const job = createJob('sales_order.created', { orderId: 'SO-1' });
        
        await processEvent(job, mockDb);
        
        // Even though one failed, we should still call the second one
        expect(fetchSpy).toHaveBeenCalledTimes(2);

        // And still mark as terminal success
        expect(mockDb.update).toHaveBeenCalledTimes(1);
        expect(mockDb.set).toHaveBeenCalledWith({ processedAt: expect.any(Date), lockedUntil: null });
      });

      it('should gracefully handle network errors (fetch throw) from webhooks without failing the event', async () => {
        fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));
        const job = createJob('sales_order.created', { orderId: 'SO-1' });
        
        await processEvent(job, mockDb);
        
        // Second webhook should still be attempted
        expect(fetchSpy).toHaveBeenCalledTimes(2);

        // And still mark as terminal success
        expect(mockDb.update).toHaveBeenCalledTimes(1);
        expect(mockDb.set).toHaveBeenCalledWith({ processedAt: expect.any(Date), lockedUntil: null });
      });
      
      it('should NOT dispatch if no webhooks match the query (empty array returned)', async () => {
        mockDb.where.mockResolvedValue([]);
        const job = createJob('sales_order.created', { orderId: 'SO-1' });
        await processEvent(job, mockDb);
        
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(mockDb.update).toHaveBeenCalledTimes(1);
      });
    });
  });
});

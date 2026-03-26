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
    let mockErpClient: any;
    let mockDb: any;

    beforeEach(() => {
      mockErpClient = {
        createResource: vi.fn().mockResolvedValue({ name: 'PARTY-0001' })
      };
      mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis()
      };
    });

    const createJob = (type: string, payload: any): Job => {
      return {
        data: { eventId: 1, type, payload }
      } as unknown as Job;
    };

    it('should JIT sync customer for sales_invoiced', async () => {
      const job = createJob('sales_invoiced', {
        customerId: 'CUST-1',
        customerName: 'Acme Corp',
        invoiceNumber: 'INV-1'
      });

      await processEvent(job, mockErpClient, mockDb);

      expect(mockErpClient.createResource).toHaveBeenCalledTimes(1);
      expect(mockErpClient.createResource).toHaveBeenCalledWith('Customer', {
        customer_name: 'Acme Corp',
        customer_type: 'Company',
        customer_group: 'Commercial',
        territory: 'All Territories'
      });
      // Called once to save the JIT ID to the account, and once to mark the outbox successful
      expect(mockDb.update).toHaveBeenCalledTimes(2);
      expect(mockDb.set).toHaveBeenCalledWith({ processedAt: expect.any(Date), lockedUntil: null });
    });

    it('should skip customer sync if erpnextId exists', async () => {
      const job = createJob('sales_invoiced', {
        erpnextId: 'EXISTING-CUST',
        customerId: 'CUST-1',
      });
      await processEvent(job, mockErpClient, mockDb);
      expect(mockErpClient.createResource).not.toHaveBeenCalled();
    });

    it('should JIT sync supplier for purchase_invoiced', async () => {
      const job = createJob('purchase_invoiced', {
        supplierId: 'SUPP-1',
        supplierName: 'Global Dist',
      });

      await processEvent(job, mockErpClient, mockDb);

      expect(mockErpClient.createResource).toHaveBeenCalledWith('Supplier', expect.anything());
      expect(mockDb.update).toHaveBeenCalledTimes(2);
    });

    it('should log an error to lastError if processEvent throws', async () => {
      const job = createJob('sales_invoiced', {
         customerId: 'CUST-FAIL',
         customerName: 'Fail Corp'
      });

      mockErpClient.createResource.mockRejectedValue(new Error('Network Error'));

      await expect(processEvent(job, mockErpClient, mockDb)).rejects.toThrow('Network Error');
      
      expect(mockDb.set).toHaveBeenCalledWith({
         lastError: 'Network Error',
         lockedUntil: null
      });
    });
  });
});

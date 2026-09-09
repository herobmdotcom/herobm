import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Job } from 'bullmq';
import { checkSupplierCompliance } from './check-supplier-compliance.service';
import { relayLogger } from './logger';
import { suppliers, supplierExpiries, systemEvents, outbox } from '@herobm/db-schema';

describe('check-supplier-compliance.service', () => {
  let mockJob: Job;
  let mockDb: any;
  let mockTx: any;

  beforeEach(() => {
    mockJob = { id: 'job-compliance-1' } as unknown as Job;
    mockTx = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(true),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(true),
      }),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return { blockedCount: 0 } when no expired compliance documents exist', async () => {
    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    const result = await checkSupplierCompliance(mockJob, mockDb);

    expect(result).toEqual({ blockedCount: 0 });
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it('should return { blockedCount: 0 } when expired docs exist but suppliers are already blocked', async () => {
    let selectCount = 0;
    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            selectCount++;
            if (selectCount === 1) {
              // 1. Expired docs found for vendor-1 and vendor-2
              return Promise.resolve([{ vendorId: 'vendor-1' }, { vendorId: 'vendor-2' }]);
            }
            // 2. Query for suppliers to block returns empty (already blocked)
            return Promise.resolve([]);
          }),
        }),
      }),
    };

    const result = await checkSupplierCompliance(mockJob, mockDb);

    expect(result).toEqual({ blockedCount: 0 });
    expect(selectCount).toBe(2);
  });

  it('should block unblocked suppliers and emit status_changed and updated events in a transaction', async () => {
    let selectCount = 0;
    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            selectCount++;
            if (selectCount === 1) {
              return Promise.resolve([{ vendorId: 'vendor-1' }, { vendorId: 'vendor-2' }]);
            }
            // vendor-1 needs to be blocked
            return Promise.resolve([{ vendorId: 'vendor-1' }]);
          }),
        }),
      }),
      transaction: vi.fn().mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        return callback(mockTx);
      }),
    };

    const result = await checkSupplierCompliance(mockJob, mockDb);

    expect(result).toEqual({ blockedCount: 1 });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    // Verify update on suppliers table
    expect(mockTx.update).toHaveBeenCalledWith(suppliers);

    // Verify insert of 4 records: 2 systemEvents (status_changed + updated) and 2 outbox (status_changed + updated)
    expect(mockTx.insert).toHaveBeenCalledTimes(4);
    expect(mockTx.insert).toHaveBeenCalledWith(systemEvents);
    expect(mockTx.insert).toHaveBeenCalledWith(outbox);
  });

  it('should log error and rethrow when database select query fails', async () => {
    const errorSpy = vi.spyOn(relayLogger, 'error').mockImplementation(() => {});
    const dbError = new Error('Connection pool exhausted');

    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(dbError),
        }),
      }),
    };

    await expect(checkSupplierCompliance(mockJob, mockDb)).rejects.toThrow('Connection pool exhausted');

    expect(errorSpy).toHaveBeenCalledWith(
      { err: 'Connection pool exhausted' },
      'Failed to run supplier compliance check'
    );
  });

  it('should log error and rethrow when database transaction fails', async () => {
    const errorSpy = vi.spyOn(relayLogger, 'error').mockImplementation(() => {});
    const txError = new Error('Transaction deadlock detected');

    let selectCount = 0;
    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            selectCount++;
            if (selectCount === 1) {
              return Promise.resolve([{ vendorId: 'vendor-1' }]);
            }
            return Promise.resolve([{ vendorId: 'vendor-1' }]);
          }),
        }),
      }),
      transaction: vi.fn().mockRejectedValue(txError),
    };

    await expect(checkSupplierCompliance(mockJob, mockDb)).rejects.toThrow('Transaction deadlock detected');

    expect(errorSpy).toHaveBeenCalledWith(
      { err: 'Transaction deadlock detected' },
      'Failed to run supplier compliance check'
    );
  });
});

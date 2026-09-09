import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Job } from 'bullmq';
import { purgeOldEmails } from './purge-emails.service';
import { relayLogger } from './logger';
import { emailOutbox } from '@herobm/db-schema';

describe('purge-emails.service', () => {
  let mockJob: Job;
  let mockDb: any;

  beforeEach(() => {
    mockJob = { id: 'job-purge-1' } as unknown as Job;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully purge emails older than 30 days and return deleted count', async () => {
    mockDb = {
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'email-1' }, { id: 'email-2' }]),
        }),
      }),
    };

    const result = await purgeOldEmails(mockJob, mockDb);

    expect(result).toEqual({ deletedCount: 2 });
    expect(mockDb.delete).toHaveBeenCalledWith(emailOutbox);
  });

  it('should handle zero deleted emails gracefully', async () => {
    mockDb = {
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    const result = await purgeOldEmails(mockJob, mockDb);

    expect(result).toEqual({ deletedCount: 0 });
    expect(mockDb.delete).toHaveBeenCalledWith(emailOutbox);
  });

  it('should log error and rethrow when delete operation fails', async () => {
    const errorSpy = vi.spyOn(relayLogger, 'error').mockImplementation(() => {});
    const dbError = new Error('Database disk full');

    mockDb = {
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(dbError),
        }),
      }),
    };

    await expect(purgeOldEmails(mockJob, mockDb)).rejects.toThrow('Database disk full');

    expect(errorSpy).toHaveBeenCalledWith(
      { err: 'Database disk full' },
      'Failed to purge old emails'
    );
  });
});

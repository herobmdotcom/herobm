import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pollOutbox, processEvent, resolveWebhookSecretKey } from './relay.service';
import { relayLogger } from './logger';
import { Job } from 'bullmq';
import { deriveEncryptionKey, encrypt } from '@herobm/shared/node';
import * as crypto from 'crypto';

describe('relay.service', () => {
  describe('resolveWebhookSecretKey (BL-061)', () => {
    const testSecret = 'whsec_mysecretkey1234567890';
    const originalKey = process.env.ENCRYPTION_KEY;

    beforeEach(() => {
      process.env.ENCRYPTION_KEY = 'test-encryption-key-for-worker-suite';
    });

    afterEach(() => {
      process.env.ENCRYPTION_KEY = originalKey;
    });

    it('should decrypt AES-256-GCM encrypted secret key', () => {
      const encKey = deriveEncryptionKey(process.env.ENCRYPTION_KEY!);
      const encryptedSecret = encrypt(testSecret, encKey);

      const decrypted = resolveWebhookSecretKey(encryptedSecret);
      expect(decrypted).toBe(testSecret);
    });

    it('should return raw plaintext secret key if not encrypted (legacy backward compatibility)', () => {
      const plainSecret = 'whsec_plainlegacysecret';
      const result = resolveWebhookSecretKey(plainSecret);
      expect(result).toBe(plainSecret);
    });

    it('should return empty string if secret is empty', () => {
      expect(resolveWebhookSecretKey('')).toBe('');
    });
  });

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

    it('should poll pending events and enqueue them with retry backoff', async () => {
      await pollOutbox(mockDb, mockQueue);
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-event',
        expect.any(Object),
        expect.objectContaining({
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 }
        })
      );
      expect(mockDb.update).toHaveBeenCalledTimes(2);
      expect(mockDb.set).toHaveBeenCalledWith({ lockedUntil: expect.any(Date) });
    });

    it('should handle empty result gracefully', async () => {
      mockDb.limit.mockResolvedValue([]);
      await pollOutbox(mockDb, mockQueue);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should log error when database query fails during polling', async () => {
      const errorSpy = vi.spyOn(relayLogger, 'error').mockImplementation(() => {});
      const dbError = new Error('Database connection failed');
      mockDb.limit.mockRejectedValue(dbError);

      await pollOutbox(mockDb, mockQueue);

      expect(errorSpy).toHaveBeenCalledWith(
        { err: dbError },
        'Error polling outbox'
      );
      expect(mockQueue.add).not.toHaveBeenCalled();
      errorSpy.mockRestore();
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

      it('should decrypt encrypted webhook secret and produce valid HMAC-SHA256 signature (BL-061)', async () => {
        const rawSecret = 'whsec_secure_production_secret_999';
        process.env.ENCRYPTION_KEY = 'test-encryption-key-for-worker-suite';
        const encKey = deriveEncryptionKey(process.env.ENCRYPTION_KEY);
        const encryptedSecret = encrypt(rawSecret, encKey);

        mockDb.where.mockResolvedValue([
          {
            webhookId: 'wh-enc',
            targetUrl: 'https://webhook.site/secure',
            secretKey: encryptedSecret,
            isActive: true,
            eventTypes: ['sales_order.created'],
          },
        ]);

        const job = createJob('sales_order.created', { orderId: 'SO-1' });
        await processEvent(job, mockDb);

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const callArgs = fetchSpy.mock.calls[0];
        const requestBody = callArgs[1].body;
        const sentSignature = callArgs[1].headers['x-herobm-signature'];

        // Expected signature calculated with the decrypted rawSecret
        const expectedSignature = crypto
          .createHmac('sha256', rawSecret)
          .update(requestBody)
          .digest('hex');

        expect(sentSignature).toBe(expectedSignature);
      });

      it('should attempt all webhooks and throw on HTTP 500 errors to trigger BullMQ retry', async () => {
        fetchSpy.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
        const job = createJob('sales_order.created', { orderId: 'SO-1' });
        
        await expect(processEvent(job, mockDb)).rejects.toThrow('Webhook dispatch failed: Webhook wh-1 returned status 500');
        
        // Even though one failed, we should still call the second one
        expect(fetchSpy).toHaveBeenCalledTimes(2);

        // And mark as failed in outbox
        expect(mockDb.update).toHaveBeenCalledTimes(1);
        expect(mockDb.set).toHaveBeenCalledWith({
          lastError: expect.stringContaining('Webhook dispatch failed'),
          lockedUntil: null,
        });
      });

      it('should attempt all webhooks and throw on network errors to trigger BullMQ retry', async () => {
        fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));
        const job = createJob('sales_order.created', { orderId: 'SO-1' });
        
        await expect(processEvent(job, mockDb)).rejects.toThrow('Webhook dispatch failed: Webhook wh-1 error: ECONNREFUSED');
        
        // Second webhook should still be attempted
        expect(fetchSpy).toHaveBeenCalledTimes(2);

        // And mark as failed in outbox
        expect(mockDb.update).toHaveBeenCalledTimes(1);
        expect(mockDb.set).toHaveBeenCalledWith({
          lastError: expect.stringContaining('Webhook dispatch failed'),
          lockedUntil: null,
        });
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


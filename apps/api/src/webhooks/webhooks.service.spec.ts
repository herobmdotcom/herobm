import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from './webhooks.service';
import { EncryptionService } from '../common/encryption.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';

describe('WebhooksService Security & Encryption (BL-061)', () => {
  let service: WebhooksService;
  let mockDb: any;
  let mockEncryptionService: any;

  beforeEach(async () => {
    mockEncryptionService = {
      encrypt: jest.fn((plain: string) => `encrypted_iv:tag:${plain}`),
      decrypt: jest.fn((payload: string) =>
        payload.replace('encrypted_iv:tag:', ''),
      ),
    };

    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn(),
      transaction: jest.fn(async (cb) => cb(mockDb)),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: EncryptionService, useValue: mockEncryptionService },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
  });

  describe('create', () => {
    it('should encrypt secretKey before storing in database and return raw secret to caller', async () => {
      const insertedWebhook = {
        webhookId: 'wh-123',
        targetUrl: 'https://example.com/webhook',
        eventTypes: ['sales_order.created'],
        // eslint-disable-next-line no-restricted-syntax -- ADV-024: TEST_CREDENTIAL mock webhook secret
        secretKey: 'encrypted_iv:tag:whsec_dummy',
        isActive: true,
      };
      mockDb.returning.mockResolvedValueOnce([insertedWebhook]);

      const result = await service.create(
        {
          targetUrl: 'https://example.com/webhook',
          eventTypes: ['sales_order.created'],
        },
        'admin_user',
      );

      // Verify encryption service was called on the raw secret
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(
        expect.stringMatching(/^whsec_[0-9a-f]{64}$/),
      );

      // Verify encrypted secret was passed to database insert
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          targetUrl: 'https://example.com/webhook',
          secretKey: expect.stringMatching(/^encrypted_iv:tag:whsec_/),
        }),
      );

      // Verify caller receives the unencrypted raw secret
      expect(result.secretKey).toMatch(/^whsec_[0-9a-f]{64}$/);
      expect(result.webhookId).toBe('wh-123');
    });
  });

  describe('list', () => {
    it('should decrypt encrypted secretKey and return masked prefix', async () => {
      mockDb.from.mockResolvedValueOnce([
        {
          webhookId: 'wh-1',
          targetUrl: 'https://example.com/1',
          // eslint-disable-next-line no-restricted-syntax -- ADV-024: TEST_CREDENTIAL mock webhook secret
          secretKey: 'encrypted_iv:tag:whsec_0123456789abcdef',
          isActive: true,
        },
        {
          webhookId: 'wh-2',
          targetUrl: 'https://example.com/2',
          // eslint-disable-next-line no-restricted-syntax -- ADV-024: TEST_CREDENTIAL mock webhook secret
          secretKey: 'whsec_legacyplaintext123',
          isActive: true,
        },
      ]);

      const result = await service.list();

      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith(
        'encrypted_iv:tag:whsec_0123456789abcdef',
      );
      expect(result[0].secretKey).toBe('whsec_0123...');
      expect(result[1].secretKey).toBe('whsec_lega...');
    });
  });

  describe('update', () => {
    it('should decrypt and mask secretKey on update result', async () => {
      const existing = {
        webhookId: 'wh-1',
        targetUrl: 'https://example.com/old',
        eventTypes: ['sales_order.created'],
        // eslint-disable-next-line no-restricted-syntax -- ADV-024: TEST_CREDENTIAL mock webhook secret
        secretKey: 'encrypted_iv:tag:whsec_0123456789abcdef',
        isActive: true,
      };
      mockDb.limit.mockResolvedValueOnce([existing]);
      mockDb.returning.mockResolvedValueOnce([
        {
          ...existing,
          targetUrl: 'https://example.com/new',
        },
      ]);

      const result = await service.update(
        'wh-1',
        { targetUrl: 'https://example.com/new' },
        'admin_user',
      );

      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith(
        'encrypted_iv:tag:whsec_0123456789abcdef',
      );
      expect(result.secretKey).toBe('whsec_0123...');
      expect(result.targetUrl).toBe('https://example.com/new');
    });
  });
});

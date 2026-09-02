import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pollEmailOutbox } from './email-relay';
import * as nodemailer from 'nodemailer';

vi.mock('nodemailer');

describe('email-relay', () => {
  let mockDb: any;
  let mockTransporter: any;
  let pendingEmails: any[];
  let settingsRows: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    pendingEmails = [
      {
        id: 'email-1',
        toAddress: 'test@example.com',
        subject: 'Test Subject',
        htmlBody: '<p>Test Body</p>',
        attachments: [],
        retries: 0,
      },
    ];

    settingsRows = [
      {
        smtpHost: 'localhost',
        smtpPort: 1025,
        smtpUser: 'testuser',
        smtpPassEncrypted: null, // Test without encryption first
        smtpFromAddress: 'noreply@test.com',
      },
    ];

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation((limit: number) => {
        // First select is emailOutbox
        if (limit === 50) return Promise.resolve(pendingEmails);
        // Second select is appSettings
        if (limit === 1) return Promise.resolve(settingsRows);
        return Promise.resolve([]);
      }),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue([]),
    };

    mockTransporter = {
      verify: vi.fn().mockResolvedValue(true),
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
      close: vi.fn(),
    };

    vi.mocked(nodemailer.createTransport).mockReturnValue(mockTransporter as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should process pending emails and update their status to sent', async () => {
    await pollEmailOutbox(mockDb);

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'localhost',
      port: 1025,
      secure: false,
      auth: {
        user: 'testuser',
        pass: '',
      },
    });

    expect(mockTransporter.verify).toHaveBeenCalled();
    expect(mockTransporter.sendMail).toHaveBeenCalledWith({
      from: 'noreply@test.com',
      to: 'test@example.com',
      replyTo: undefined,
      subject: 'Test Subject',
      html: '<p>Test Body</p>',
      attachments: [],
    });

    // Verify terminal success
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(mockDb.set).toHaveBeenCalledWith({
      status: 'sent',
      processedAt: expect.any(Date),
      attachments: [],
    });
  });

  it('should gracefully handle empty email outbox', async () => {
    pendingEmails = [];
    await pollEmailOutbox(mockDb);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('should update pending emails with error when SMTP settings are missing', async () => {
    settingsRows = [];
    await pollEmailOutbox(mockDb);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(mockDb.set).toHaveBeenCalledWith({
      retries: '1',
      status: 'pending',
      lastError: 'SMTP configuration is missing in Settings',
      nextRetryAt: expect.any(Date),
    });
  });

  it('should update pending emails with error when smtpHost is null or empty', async () => {
    settingsRows = [{ smtpHost: '' }];
    await pollEmailOutbox(mockDb);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(mockDb.set).toHaveBeenCalledWith({
      retries: '1',
      status: 'pending',
      lastError: 'SMTP configuration is missing in Settings',
      nextRetryAt: expect.any(Date),
    });
  });

  it('should handle SMTP verification failure and skip processing', async () => {
    mockTransporter.verify.mockRejectedValue(new Error('Connection refused'));
    await pollEmailOutbox(mockDb);

    // It should verify but NOT sendMail
    expect(mockTransporter.verify).toHaveBeenCalled();
    expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(mockDb.set).toHaveBeenCalledWith({
      retries: '1',
      status: 'pending',
      lastError: 'SMTP Connection Failed: Connection refused',
      nextRetryAt: expect.any(Date),
    });
  });

  it('should increment retry count on send failure', async () => {
    mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));
    await pollEmailOutbox(mockDb);

    expect(mockTransporter.sendMail).toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(mockDb.set).toHaveBeenCalledWith({
      retries: '1',
      status: 'pending',
      lastError: 'SMTP error',
      nextRetryAt: expect.any(Date),
    });
  });

  it('should mark as failed after 5 retries', async () => {
    pendingEmails[0].retries = 4; // next try will be 5
    mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));
    
    await pollEmailOutbox(mockDb);

    expect(mockDb.set).toHaveBeenCalledWith({
      retries: '5',
      status: 'failed',
      lastError: 'SMTP error',
      nextRetryAt: expect.any(Date),
    });
  });

  it('should insert exactly one outbox row when entityType and entityId are present', async () => {
    pendingEmails[0].entityType = 'sales_order';
    pendingEmails[0].entityId = 'so-123';
    
    await pollEmailOutbox(mockDb);

    expect(mockTransporter.sendMail).toHaveBeenCalled();
    
    // We expect exactly 3 inserts total on success:
    // 1 for emailEventsTable (always logged)
    // 1 for the specific entity events table (sales_events)
    // 1 for the outbox
    expect(mockDb.insert).toHaveBeenCalledTimes(3);
    expect(mockDb.values).toHaveBeenCalledTimes(3);
    
    // Verify that the outbox insert uses the correct payload and event type
    const valuesCalls = mockDb.values.mock.calls;
    const outboxCall = valuesCalls.find((call: any[]) => call[0].eventType === 'email.sent' && call[0].outboxId);
    expect(outboxCall).toBeDefined();
  });
});

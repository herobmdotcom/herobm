import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import {
  DocumentDispatchService,
  DispatchDocumentDto,
} from './document-dispatch.service';
import { PdfTemplatesService } from '../pdf-templates/pdf-templates.service';
import { EmailService } from '../email/email.service';
import { AppConfigService } from '../settings/app-config.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { JwtUser } from '../auth/auth-user.decorator';

describe('DocumentDispatchService', () => {
  let service: DocumentDispatchService;
  let mockPdfTemplatesService: { runHook: jest.Mock };
  let mockEmailService: { queueEmail: jest.Mock };
  let mockAppConfigService: { isSmtpConfigured: jest.Mock };
  let mockDb: { transaction: jest.Mock };

  const mockUser: JwtUser = {
    userId: 'usr-1',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
  };

  const sampleDto: DispatchDocumentDto = {
    targetId: 'so-123',
    hookSlug: 'sales-order-quote',
    contextSlug: 'sales_order',
    entityType: 'sales_order',
    entityId: 'so-123',
    emailAddress: 'customer@example.com',
    subject: 'Your Quote',
    body: 'Please find attached your quote.',
  };

  beforeEach(async () => {
    mockPdfTemplatesService = {
      runHook: jest.fn().mockResolvedValue({
        pdfBuffer: Buffer.from('mock-pdf'),
        fileName: 'Quote-so-123.pdf',
      }),
    };

    mockEmailService = {
      queueEmail: jest.fn().mockResolvedValue(undefined),
    };

    mockAppConfigService = {
      isSmtpConfigured: jest.fn().mockReturnValue(true),
    };

    mockDb = {
      transaction: jest.fn().mockImplementation(async (cb) => cb({})),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentDispatchService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: PdfTemplatesService, useValue: mockPdfTemplatesService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: AppConfigService, useValue: mockAppConfigService },
      ],
    }).compile();

    service = module.get<DocumentDispatchService>(DocumentDispatchService);
  });

  it('should throw BadRequestException if SMTP settings are not configured', async () => {
    mockAppConfigService.isSmtpConfigured.mockReturnValue(false);

    await expect(service.emailDocument(sampleDto, mockUser)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.emailDocument(sampleDto, mockUser)).rejects.toThrow(
      'SMTP settings are not configured. Please configure SMTP settings in Admin Settings before sending emails.',
    );

    expect(mockPdfTemplatesService.runHook).not.toHaveBeenCalled();
    expect(mockEmailService.queueEmail).not.toHaveBeenCalled();
  });

  it('should successfully generate PDF and queue email when SMTP is configured', async () => {
    mockAppConfigService.isSmtpConfigured.mockReturnValue(true);

    const result = await service.emailDocument(sampleDto, mockUser);

    expect(result).toEqual({ success: true });
    expect(mockPdfTemplatesService.runHook).toHaveBeenCalledWith(
      'sales-order-quote',
      'so-123',
      'sales_order',
      mockUser,
      { customPdfText: undefined },
    );
    expect(mockEmailService.queueEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        toAddress: 'customer@example.com',
        subject: 'Your Quote',
        entityType: 'sales_order',
        entityId: 'so-123',
        actor: 'admin',
      }),
    );
  });
});

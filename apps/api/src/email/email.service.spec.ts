import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { emailOutbox } from '../drizzle/modbm-core-schema';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should queue an email correctly', async () => {
    // Mock the Drizzle transaction
    const mockReturning = jest.fn().mockResolvedValue([{ id: 'mock-id' }]);
    const mockValues = jest.fn().mockReturnValue({ returning: mockReturning });
    const mockInsert = jest.fn().mockReturnValue({ values: mockValues });
    const mockTx = { insert: mockInsert } as any;

    await service.queueEmail(mockTx, {
      toAddress: 'test@example.com',
      subject: 'Test Subject',
      htmlBody: '<p>Test</p>',
    });

    expect(mockInsert).toHaveBeenCalledWith(emailOutbox);
    expect(mockValues).toHaveBeenCalledWith({
      toAddress: 'test@example.com',
      replyTo: undefined,
      subject: 'Test Subject',
      htmlBody: '<p>Test</p>',
      attachments: [],
      status: 'pending',
      retries: 0,
    });
  });
});

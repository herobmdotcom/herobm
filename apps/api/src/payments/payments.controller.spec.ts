import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsCoreService } from './payments-core.service';
import { PaymentsWriteService } from './payments-write.service';
import { PaymentsAllocationService } from './payments-allocation.service';
import { PaymentsPostingService } from './payments-posting.service';
import { PaymentRunGeneratorService } from './payment-run-generator.service';
import { DocumentDispatchService } from '../notifications/document-dispatch.service';
import { NotFoundException } from '@nestjs/common';

describe('PaymentsController', () => {
  let controller: PaymentsController;

  const mockPaymentsCoreService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  const mockPaymentsWriteService = {
    createPaymentEntry: jest.fn(),
    cancelPayment: jest.fn(),
  };

  const mockPaymentsAllocationService = {
    allocatePayment: jest.fn(),
  };

  const mockPaymentsPostingService = {
    submitPaymentEntry: jest.fn(),
    confirmExported: jest.fn(),
    rejectExported: jest.fn(),
  };

  const mockPaymentRunGeneratorService = {
    getPaymentRunCandidates: jest.fn(),
    generatePaymentRun: jest.fn(),
  };

  const mockDocumentDispatchService = {
    emailDocument: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsCoreService, useValue: mockPaymentsCoreService },
        { provide: PaymentsWriteService, useValue: mockPaymentsWriteService },
        {
          provide: PaymentsAllocationService,
          useValue: mockPaymentsAllocationService,
        },
        {
          provide: PaymentsPostingService,
          useValue: mockPaymentsPostingService,
        },
        {
          provide: PaymentRunGeneratorService,
          useValue: mockPaymentRunGeneratorService,
        },
        {
          provide: DocumentDispatchService,
          useValue: mockDocumentDispatchService,
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  describe('emailDocument', () => {
    it('should throw NotFoundException when payment does not exist', async () => {
      mockPaymentsCoreService.findOne.mockResolvedValue(null);

      await expect(
        controller.emailDocument(
          'non-existent',
          {
            emailAddress: 'accounts@supplier.com',
            subject: 'Remittance',
            body: 'Remittance details',
          },
          {
            userId: 'user-1',
            username: 'admin',
            email: 'admin@modbm.com',
            role: 'admin',
          },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should queue supplier remittance document for email dispatch', async () => {
      mockPaymentsCoreService.findOne.mockResolvedValue({
        paymentId: 'pmt-1',
        paymentNumber: 'PMT-001',
      });

      const dto = {
        emailAddress: 'accounts@supplier.com',
        subject: 'Remittance Advice: PMT-001',
        body: 'Please find attached your remittance advice.',
        customPdfText: 'Direct EFT processed.',
      };

      const result = await controller.emailDocument('pmt-1', dto, {
        userId: 'user-1',
        username: 'admin',
        email: 'admin@modbm.com',
        role: 'admin',
      });

      expect(result).toEqual({ success: true });
      expect(mockDocumentDispatchService.emailDocument).toHaveBeenCalledWith(
        {
          targetId: 'pmt-1',
          hookSlug: 'supplier-remittance-advice',
          contextSlug: 'supplier-remittance-advice',
          entityType: 'payment',
          entityId: 'pmt-1',
          emailAddress: 'accounts@supplier.com',
          subject: 'Remittance Advice: PMT-001',
          body: 'Please find attached your remittance advice.',
          customPdfText: 'Direct EFT processed.',
          fallbackFileName: 'Remittance-PMT-001.pdf',
        },
        expect.objectContaining({ userId: 'user-1' }),
      );
    });

    it('should queue customer payment receipt document for email dispatch', async () => {
      mockPaymentsCoreService.findOne.mockResolvedValue({
        paymentId: 'pmt-2',
        paymentNumber: 'REC-002',
        paymentType: 'customer_receipt',
      });

      const dto = {
        emailAddress: 'billing@customer.com',
        subject: 'Payment Receipt: REC-002',
        body: 'Thank you for your payment.',
        hookSlug: 'customer-payment-receipt',
        contextSlug: 'customer-payment-receipt',
      };

      const result = await controller.emailDocument('pmt-2', dto, {
        userId: 'user-1',
        username: 'admin',
        email: 'admin@modbm.com',
        role: 'admin',
      });

      expect(result).toEqual({ success: true });
      expect(mockDocumentDispatchService.emailDocument).toHaveBeenCalledWith(
        {
          targetId: 'pmt-2',
          hookSlug: 'customer-payment-receipt',
          contextSlug: 'customer-payment-receipt',
          entityType: 'payment',
          entityId: 'pmt-2',
          emailAddress: 'billing@customer.com',
          subject: 'Payment Receipt: REC-002',
          body: 'Thank you for your payment.',
          customPdfText: undefined,
          fallbackFileName: 'Receipt-REC-002.pdf',
        },
        expect.objectContaining({ userId: 'user-1' }),
      );
    });
  });
});

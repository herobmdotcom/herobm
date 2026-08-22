import { Test, TestingModule } from '@nestjs/testing';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomersWriteService } from './customers-write.service';
import { CreditAssessmentService } from './credit-assessment.service';
import { DocumentDispatchService } from '../notifications/document-dispatch.service';

describe('CustomersController', () => {
  let controller: CustomersController;

  const mockResult = {
    data: [{ customerId: 'C001', name: 'Acme Corp' }],
    page: 1,
    limit: 50,
    total: 1,
  };

  const mockService = {
    findAll: jest.fn().mockResolvedValue(mockResult),
    findOne: jest
      .fn()
      .mockResolvedValue({ customerId: 'C001', name: 'Acme Corp' }),
  };

  const mockWriteService = {
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockCreditAssessmentService = {
    assessCredit: jest.fn(),
  };

  const mockDocumentDispatchService = {
    emailDocument: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        { provide: CustomersService, useValue: mockService },
        { provide: CustomersWriteService, useValue: mockWriteService },
        {
          provide: CreditAssessmentService,
          useValue: mockCreditAssessmentService,
        },
        {
          provide: DocumentDispatchService,
          useValue: mockDocumentDispatchService,
        },
      ],
    }).compile();

    controller = module.get<CustomersController>(CustomersController);
  });

  describe('findAll', () => {
    it('should call service.findAll with empty query', async () => {
      const result = await controller.findAll({});
      expect(result).toEqual(mockResult);
      expect(mockService.findAll).toHaveBeenCalledWith({});
    });

    it('should pass through PaginationQuery object', async () => {
      const query = { q: 'acme', page: 2, limit: 25 };
      await controller.findAll(query);
      expect(mockService.findAll).toHaveBeenCalledWith(query);
    });

    it('should pass search without pagination', async () => {
      const query = { q: 'test' };
      await controller.findAll(query);
      expect(mockService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with the ID', async () => {
      const result = await controller.findOne('C001');
      expect(result).toEqual({ customerId: 'C001', name: 'Acme Corp' });
      expect(mockService.findOne).toHaveBeenCalledWith('C001');
    });
  });

  describe('emailDocument', () => {
    it('should queue customer statement document for email dispatch', async () => {
      const dto = {
        emailAddress: 'accounts@acmecorp.com',
        subject: 'Statement of Account: CUST-001',
        body: 'Please find attached your monthly statement.',
        customPdfText: 'Payment due within 30 days.',
      };

      const result = await controller.emailDocument('C001', dto, {
        userId: 'user-1',
        username: 'user-1',
        email: 'user1@test.com',
        role: 'admin',
      });

      expect(result).toEqual({ success: true });
      expect(mockDocumentDispatchService.emailDocument).toHaveBeenCalledWith(
        {
          targetId: 'C001',
          hookSlug: 'customer-statement',
          contextSlug: 'customer-statement',
          entityType: 'customer',
          entityId: 'C001',
          emailAddress: 'accounts@acmecorp.com',
          subject: 'Statement of Account: CUST-001',
          body: 'Please find attached your monthly statement.',
          customPdfText: 'Payment due within 30 days.',
          fallbackFileName: 'Statement-C001.pdf',
        },
        expect.objectContaining({ userId: 'user-1' }),
      );
    });
  });
});

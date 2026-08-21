import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersQueryService } from './purchase-orders-query.service';
import { DocumentDispatchService } from '../notifications/document-dispatch.service';
import type { JwtUser } from '../auth/auth-user.decorator';

describe('PurchaseOrdersController', () => {
  let controller: PurchaseOrdersController;
  let documentDispatchService: { emailDocument: jest.Mock };
  let purchaseOrdersQueryService: { findOne: jest.Mock };

  const mockUser: JwtUser = {
    userId: 'user-1',
    username: 'admin',
    email: 'admin@herobm.com',
    role: 'admin',
  };

  beforeEach(async () => {
    documentDispatchService = {
      emailDocument: jest.fn().mockResolvedValue({ success: true }),
    };

    purchaseOrdersQueryService = {
      findOne: jest.fn().mockResolvedValue({
        purchaseOrderId: 'po-1',
        orderNumber: 'PO-0001',
        vendorId: 'vendor-1',
        vendorName: 'Supplier Corp',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseOrdersController],
      providers: [
        {
          provide: PurchaseOrdersService,
          useValue: {
            findAll: jest
              .fn()
              .mockResolvedValue({ data: [], page: 1, limit: 50, total: 0 }),
            findOne: jest.fn().mockResolvedValue({}),
            create: jest.fn().mockResolvedValue({}),
            update: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: PurchaseOrdersQueryService,
          useValue: purchaseOrdersQueryService,
        },
        {
          provide: DocumentDispatchService,
          useValue: documentDispatchService,
        },
      ],
    }).compile();

    controller = module.get<PurchaseOrdersController>(PurchaseOrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('emailDocument', () => {
    it('should queue the document for email using DocumentDispatchService', async () => {
      const dto = {
        emailAddress: 'sales@supplier.com',
        subject: 'Purchase Order: PO-0001',
        body: 'Please process this PO.',
      };

      const result = await controller.emailDocument('po-1', dto, mockUser);
      expect(purchaseOrdersQueryService.findOne).toHaveBeenCalledWith('po-1');
      expect(documentDispatchService.emailDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: 'po-1',
          hookSlug: 'purchase-order',
          contextSlug: 'purchase-order',
          entityType: 'purchase_order',
          entityId: 'po-1',
          emailAddress: 'sales@supplier.com',
          subject: 'Purchase Order: PO-0001',
          body: 'Please process this PO.',
          fallbackFileName: 'PurchaseOrder-PO-0001.pdf',
        }),
        mockUser,
      );
      expect(result).toEqual({ success: true });
    });
  });
});

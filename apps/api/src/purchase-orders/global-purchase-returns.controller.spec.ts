import { Test, TestingModule } from '@nestjs/testing';
import { GlobalPurchaseReturnsController } from './global-purchase-returns.controller';
import { PurchaseReturnsService } from './purchase-returns.service';
import { DocumentDispatchService } from '../notifications/document-dispatch.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { NotFoundException } from '@nestjs/common';

describe('GlobalPurchaseReturnsController', () => {
  let controller: GlobalPurchaseReturnsController;
  let documentDispatchService: { emailDocument: jest.Mock };
  let purchaseReturnsService: { changePurchaseReturnState: jest.Mock };
  let mockDb: any;

  beforeEach(async () => {
    documentDispatchService = {
      emailDocument: jest.fn().mockResolvedValue({ success: true }),
    };

    purchaseReturnsService = {
      changePurchaseReturnState: jest.fn(),
    };

    mockDb = {
      select: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GlobalPurchaseReturnsController],
      providers: [
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
        {
          provide: PurchaseReturnsService,
          useValue: purchaseReturnsService,
        },
        {
          provide: DocumentDispatchService,
          useValue: documentDispatchService,
        },
      ],
    }).compile();

    controller = module.get<GlobalPurchaseReturnsController>(
      GlobalPurchaseReturnsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('emailDocument', () => {
    it('should throw NotFoundException if return not found', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        controller.emailDocument(
          'ret-999',
          {
            hookSlug: 'purchase-return',
            emailAddress: 'rep@supplier.com',
            subject: 'Test Subject',
            body: 'Test Body',
          },
          {
            userId: 'user-1',
            username: 'user-1',
            email: 'user1@test.com',
            role: 'admin',
          },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should queue purchase return document for email dispatch', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              {
                returnId: 'ret-1',
                returnNumber: 'PRET-0001',
                purchaseOrderId: 'po-1',
              },
            ]),
          }),
        }),
      });

      const dto = {
        hookSlug: 'purchase-return',
        emailAddress: 'sales@supplier.com',
        subject: 'Return Authorization: PRET-0001',
        body: 'Please find attached RMA return docket.',
        customPdfText: 'Goods packed on standard pallet.',
      };

      const result = await controller.emailDocument('ret-1', dto, {
        userId: 'user-1',
        username: 'user-1',
        email: 'user1@test.com',
        role: 'admin',
      });

      expect(result).toEqual({ success: true });
      expect(documentDispatchService.emailDocument).toHaveBeenCalledWith(
        {
          targetId: 'ret-1',
          hookSlug: 'purchase-return',
          contextSlug: DATA_SOURCE_CONTEXT.PURCHASE_RETURN,
          entityType: 'purchase_order',
          entityId: 'po-1',
          emailAddress: 'sales@supplier.com',
          subject: 'Return Authorization: PRET-0001',
          body: 'Please find attached RMA return docket.',
          customPdfText: 'Goods packed on standard pallet.',
          fallbackFileName: 'PurchaseReturn-PRET-0001.pdf',
        },
        expect.objectContaining({ userId: 'user-1' }),
      );
    });
  });
});

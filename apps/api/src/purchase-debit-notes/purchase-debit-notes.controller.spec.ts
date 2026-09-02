import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseDebitNotesController } from './purchase-debit-notes.controller';
import { PurchaseDebitNotesService } from './purchase-debit-notes.service';
import { DocumentDispatchService } from '../notifications/document-dispatch.service';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { NotFoundException } from '@nestjs/common';

describe('PurchaseDebitNotesController', () => {
  let controller: PurchaseDebitNotesController;
  let documentDispatchService: { emailDocument: jest.Mock };
  let debitNotesService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    createDebitNote: jest.Mock;
    postDebitNote: jest.Mock;
  };

  beforeEach(async () => {
    documentDispatchService = {
      emailDocument: jest.fn().mockResolvedValue({ success: true }),
    };

    debitNotesService = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      createDebitNote: jest.fn(),
      postDebitNote: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseDebitNotesController],
      providers: [
        {
          provide: PurchaseDebitNotesService,
          useValue: debitNotesService,
        },
        {
          provide: DocumentDispatchService,
          useValue: documentDispatchService,
        },
      ],
    }).compile();

    controller = module.get<PurchaseDebitNotesController>(
      PurchaseDebitNotesController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('emailDocument', () => {
    it('should throw NotFoundException if debit note not found', async () => {
      debitNotesService.findOne.mockResolvedValueOnce(null);

      await expect(
        controller.emailDocument(
          'dn-999',
          {
            hookSlug: 'purchase-debit-note',
            emailAddress: 'accounts@supplier.com',
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

    it('should queue debit note document for email dispatch', async () => {
      debitNotesService.findOne.mockResolvedValueOnce({
        debitNoteId: 'dn-1',
        debitNoteNumber: 'PDN-0001',
        purchaseOrderId: 'po-1',
      });

      const dto = {
        hookSlug: 'purchase-debit-note',
        emailAddress: 'accounts@supplier.com',
        subject: 'Debit Note: PDN-0001',
        body: 'Please find attached debit note against invoice.',
        customPdfText: 'Applied to August statement.',
      };

      const result = await controller.emailDocument('dn-1', dto, {
        userId: 'user-1',
        username: 'user-1',
        email: 'user1@test.com',
        role: 'admin',
      });

      expect(result).toEqual({ success: true });
      expect(documentDispatchService.emailDocument).toHaveBeenCalledWith(
        {
          targetId: 'dn-1',
          hookSlug: 'purchase-debit-note',
          contextSlug: DATA_SOURCE_CONTEXT.PURCHASE_DEBIT_NOTE,
          entityType: 'purchase_order',
          entityId: 'po-1',
          emailAddress: 'accounts@supplier.com',
          subject: 'Debit Note: PDN-0001',
          body: 'Please find attached debit note against invoice.',
          customPdfText: 'Applied to August statement.',
          fallbackFileName: 'DebitNote-PDN-0001.pdf',
        },
        expect.objectContaining({ userId: 'user-1' }),
      );
    });
  });
});

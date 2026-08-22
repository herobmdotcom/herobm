import { PurchaseDebitNoteService } from './purchase-debit-note.service';
import { NotFoundException } from '@nestjs/common';

describe('PurchaseDebitNoteService', () => {
  let service: PurchaseDebitNoteService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn(),
    };
    service = new PurchaseDebitNoteService(mockDb);
  });

  it('should throw NotFoundException if debit note does not exist', async () => {
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        leftJoin: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            leftJoin: jest.fn().mockReturnValue({
              leftJoin: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    await expect(service.assembleData('non-existent-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should assemble debit note data with lines, taxes, totals, and custom text', async () => {
    const debitNoteHeader = {
      debitNoteId: 'dn-1',
      debitNoteNumber: 'PDN-20260821-0001',
      stateCode: 'posted',
      supplierReferenceNumber: 'INV-SUPP-555',
      totalAmount: '550.00',
      taxAmount: '50.00',
      feeAmount: '10.00',
      currencyCode: 'EUR',
      notes: 'Price adjustment for defective goods',
      createdOn: new Date('2026-08-21T10:00:00Z'),
      purchaseOrderId: 'po-1',
      orderNumber: 'PO-20260821-0001',
      returnId: 'ret-1',
      returnNumber: 'PRET-20260821-0001',
      vendorId: 'vend-1',
      vendorName: 'Acme Parts Ltd',
      headquartersAddressLine1: '123 Supplier Road',
      city: 'Dublin',
      stateOrProvince: 'Leinster',
      postalCode: 'D01 X4A2',
      country: 'Ireland',
    };

    const debitNoteLines = [
      {
        debitNoteLineId: 'dn-line-1',
        quantityInvoiced: '5.00',
        pricePerUnit: '100.00',
        amount: '500.00',
        taxAmount: '50.00',
        description: 'Faulty motor unit credit',
        productNumber: 'MOT-001',
        productName: 'Electric Motor 500W',
        lineDescription: 'High efficiency motor',
      },
    ];

    // Mock header query
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        leftJoin: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            leftJoin: jest.fn().mockReturnValue({
              leftJoin: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([debitNoteHeader]),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    // Mock glSettings query
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([{ baseCurrency: 'AUD' }]),
      }),
    });

    // Mock lines query
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        leftJoin: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(debitNoteLines),
          }),
        }),
      }),
    });

    const result = await service.assembleData('dn-1', {
      customPdfText:
        'Debit note applied directly against Invoice #INV-SUPP-555.',
    });

    expect(result.header.debitNoteNumber).toBe('PDN-20260821-0001');
    expect(result.header.supplierName).toBe('Acme Parts Ltd');
    expect(result.header.supplierReference).toBe('INV-SUPP-555');
    expect(result.header.orderNumber).toBe('PO-20260821-0001');
    expect(result.header.returnNumber).toBe('PRET-20260821-0001');
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].productNumber).toBe('MOT-001');
    expect(result.lines[0].amount).toBe('500.00');
    expect(result.summary.subtotal).toBe('500.00');
    expect(result.summary.totalTax).toBe('50.00');
    expect(result.summary.feeAmount).toBe('10.00');
    expect(result.summary.totalAmount).toBe('550.00');
    expect(result.customPdfText).toBe(
      'Debit note applied directly against Invoice #INV-SUPP-555.',
    );
  });
});

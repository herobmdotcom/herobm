import { PurchaseReturnSlipService } from './purchase-return-slip.service';
import { NotFoundException } from '@nestjs/common';

describe('PurchaseReturnSlipService', () => {
  let service: PurchaseReturnSlipService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn(),
    };
    service = new PurchaseReturnSlipService(mockDb);
  });

  it('should throw NotFoundException if return does not exist', async () => {
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
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
    });

    await expect(service.assembleData('non-existent-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should assemble return slip data with lines, totals, and custom text', async () => {
    const returnHeader = {
      returnId: 'ret-1',
      returnNumber: 'PRET-20260821-0001',
      stateCode: 'staged',
      packingSlipNumber: 'RMA-9999',
      notes: 'Damaged during transit',
      createdOn: new Date('2026-08-21T10:00:00Z'),
      purchaseOrderId: 'po-1',
      orderNumber: 'PO-20260821-0001',
      currencyCode: 'EUR',
      vendorId: 'vend-1',
      vendorName: 'Acme Parts Ltd',
      headquartersAddressLine1: '123 Supplier Road',
      city: 'Dublin',
      stateOrProvince: 'Leinster',
      postalCode: 'D01 X4A2',
      country: 'Ireland',
    };

    const returnLines = [
      {
        returnLineId: 'line-1',
        quantityReturned: '10.00',
        reason: 'Defective unit',
        returnFee: '0',
        productNumber: 'PART-001',
        productName: 'Steel Widget',
        baseUom: 'EA',
        lineDescription: 'High strength steel widget',
        pricePerUnit: '25.00',
      },
    ];

    // Mock header query
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        leftJoin: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            leftJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([returnHeader]),
              }),
            }),
          }),
        }),
      }),
    });

    // Mock lines query
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        leftJoin: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(returnLines),
          }),
        }),
      }),
    });

    // Mock shipment query
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest
            .fn()
            .mockResolvedValue([
              { shipmentNumber: 'RMA-9999', trackingNumber: 'TRK-123' },
            ]),
        }),
      }),
    });

    const result = await service.assembleData('ret-1', {
      customPdfText: 'Please process refund immediately upon receipt.',
    });

    expect(result.header.returnNumber).toBe('PRET-20260821-0001');
    expect(result.header.supplierName).toBe('Acme Parts Ltd');
    expect(result.header.packingSlipNumber).toBe('RMA-9999');
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].productNumber).toBe('PART-001');
    expect(result.lines[0].quantity).toBe('10.00');
    expect(result.lines[0].amount).toBe('250.00');
    expect(result.summary.totalAmount).toBe('250.00');
    expect(result.customPdfText).toBe(
      'Please process refund immediately upon receipt.',
    );
  });
});

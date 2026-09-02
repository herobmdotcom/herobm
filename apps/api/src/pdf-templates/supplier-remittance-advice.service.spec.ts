import { SupplierRemittanceAdviceService } from './supplier-remittance-advice.service';
import { NotFoundException } from '@nestjs/common';

describe('SupplierRemittanceAdviceService', () => {
  let service: SupplierRemittanceAdviceService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn(),
    };
    service = new SupplierRemittanceAdviceService(mockDb);
  });

  it('should throw NotFoundException if payment does not exist', async () => {
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    await expect(service.assembleData('non-existent-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should assemble supplier remittance advice data correctly', async () => {
    const payment = {
      paymentId: 'pmt-1',
      paymentNumber: 'PMT-20260822-001',
      paymentType: 'supplier_payment',
      partyId: 'vend-1',
      paymentDate: new Date('2026-08-22T00:00:00Z'),
      modeOfPayment: 'EFT',
      totalAmount: '1450.00',
      unallocatedAmount: '0.00',
      currencyCode: 'AUD',
      referenceNumber: 'ABA-RUN-99',
      stateCode: 'submitted',
      createdOn: new Date('2026-08-22T00:00:00Z'),
    };

    const supplier = {
      vendorId: 'vend-1',
      vendorNumber: 'VEND-001',
      name: 'Apex Industrial Supplies',
      headquartersAddressLine1: '42 Machine Way',
      city: 'Sydney',
      stateOrProvince: 'NSW',
      postalCode: '2000',
      country: 'Australia',
    };

    const allocations = [
      {
        allocationId: 'alloc-1',
        referenceType: 'purchase_invoice',
        referenceId: 'inv-1',
        allocatedAmount: '1000.00',
        discountAmount: '0.00',
        invoiceNumber: 'PINV-101',
        supplierInvoiceNumber: 'SUPP-INV-888',
        invoiceDate: new Date('2026-08-01T00:00:00Z'),
        dueDate: new Date('2026-08-31T00:00:00Z'),
        totalAmount: '1000.00',
      },
      {
        allocationId: 'alloc-2',
        referenceType: 'purchase_invoice',
        referenceId: 'inv-2',
        allocatedAmount: '450.00',
        discountAmount: '50.00',
        invoiceNumber: 'PINV-102',
        supplierInvoiceNumber: 'SUPP-INV-889',
        invoiceDate: new Date('2026-08-05T00:00:00Z'),
        dueDate: new Date('2026-09-05T00:00:00Z'),
        totalAmount: '500.00',
      },
    ];

    // 1. Mock payment query
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([payment]),
        }),
      }),
    });

    // Mock glSettings query
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([{ baseCurrency: 'AUD' }]),
      }),
    });

    // 2. Mock supplier query
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        leftJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([supplier]),
          }),
        }),
      }),
    });

    // 3. Mock allocations query
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        leftJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(allocations),
          }),
        }),
      }),
    });

    const result = await service.assembleData('pmt-1', {
      customPdfText: 'Direct EFT payment processed.',
    });

    expect(result.header.paymentNumber).toBe('PMT-20260822-001');
    expect(result.header.supplierName).toBe('Apex Industrial Supplies');
    expect(result.header.supplierNumber).toBe('VEND-001');
    expect(result.header.currencyCode).toBe('AUD');
    expect(result.lines.length).toBe(2);
    expect(result.lines[0].supplierInvoiceNumber).toBe('SUPP-INV-888');
    expect(result.lines[1].discountAmount).toBe('50.00');
    expect(result.summary.totalPaid).toBe('1450.00');
    expect(result.summary.totalDiscount).toBe('50.00');
    expect(result.customPdfText).toBe('Direct EFT payment processed.');
  });
});

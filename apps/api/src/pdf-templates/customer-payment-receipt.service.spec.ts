import { CustomerPaymentReceiptService } from './customer-payment-receipt.service';
import { NotFoundException } from '@nestjs/common';

describe('CustomerPaymentReceiptService', () => {
  let service: CustomerPaymentReceiptService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn(),
    };
    const mockAppConfig: any = {
      getRemittanceBankDetails: jest.fn().mockResolvedValue({
        bankName: 'Test Bank',
        accountName: 'Test Account',
        bsb: '123-456',
        accountNumber: '12345678',
        remittanceEmail: 'remittance@example.com',
      }),
    };
    service = new CustomerPaymentReceiptService(mockDb, mockAppConfig);
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

  it('should assemble customer payment receipt data correctly', async () => {
    const payment = {
      paymentId: 'pmt-cust-1',
      paymentNumber: 'REC-20260822-001',
      paymentType: 'customer_receipt',
      partyId: 'cust-1',
      paymentDate: new Date('2026-08-22T00:00:00Z'),
      modeOfPayment: 'Credit Card',
      totalAmount: '1450.00',
      unallocatedAmount: '0.00',
      currencyCode: 'AUD',
      referenceNumber: 'TXN-987654',
      stateCode: 'submitted',
      createdOn: new Date('2026-08-22T00:00:00Z'),
    };

    const customer = {
      customerId: 'cust-1',
      customerNumber: 'CUST-001',
      name: 'Acme Commercial Ltd',
      headquartersAddressLine1: '100 Flinders Street',
      city: 'Melbourne',
      stateOrProvince: 'VIC',
      postalCode: '3000',
      country: 'Australia',
    };

    const allocations = [
      {
        allocationId: 'alloc-1',
        referenceType: 'sales_invoice',
        referenceId: 'inv-1',
        allocatedAmount: '1000.00',
        discountAmount: '0.00',
        invoiceNumber: 'SINV-101',
        customerOrderNumber: 'PO-ACME-901',
        invoiceDate: new Date('2026-08-01T00:00:00Z'),
        dueDate: new Date('2026-08-31T00:00:00Z'),
        totalAmount: '1000.00',
      },
      {
        allocationId: 'alloc-2',
        referenceType: 'sales_invoice',
        referenceId: 'inv-2',
        allocatedAmount: '450.00',
        discountAmount: '50.00',
        invoiceNumber: 'SINV-102',
        customerOrderNumber: 'PO-ACME-902',
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

    // 2. Mock customer query
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        leftJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([customer]),
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

    const result = await service.assembleData('pmt-cust-1', {
      customPdfText: 'Thank you for your prompt payment.',
    });

    expect(result.header.paymentNumber).toBe('REC-20260822-001');
    expect(result.header.customerName).toBe('Acme Commercial Ltd');
    expect(result.header.customerNumber).toBe('CUST-001');
    expect(result.header.customerAddress).toBe(
      '100 Flinders Street, Melbourne, VIC, 3000, Australia',
    );
    expect(result.header.modeOfPayment).toBe('Credit Card');
    expect(result.header.referenceNumber).toBe('TXN-987654');
    expect(result.header.currencyCode).toBe('AUD');

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].invoiceNumber).toBe('SINV-101');
    expect(result.lines[0].customerOrderNumber).toBe('PO-ACME-901');
    expect(result.lines[0].grossAmount).toBe('1000.00');
    expect(result.lines[0].allocatedAmount).toBe('1000.00');

    expect(result.lines[1].invoiceNumber).toBe('SINV-102');
    expect(result.lines[1].customerOrderNumber).toBe('PO-ACME-902');
    expect(result.lines[1].grossAmount).toBe('500.00');
    expect(result.lines[1].discountAmount).toBe('50.00');
    expect(result.lines[1].allocatedAmount).toBe('450.00');

    expect(result.summary.totalGross).toBe('1500.00');
    expect(result.summary.totalDiscount).toBe('50.00');
    expect(result.summary.totalPaid).toBe('1450.00');
    expect(result.summary.unallocatedAmount).toBe('0.00');
    expect(result.customPdfText).toBe('Thank you for your prompt payment.');
  });
});

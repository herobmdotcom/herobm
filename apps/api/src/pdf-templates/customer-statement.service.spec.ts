import { CustomerStatementService } from './customer-statement.service';
import { NotFoundException } from '@nestjs/common';

import { CUSTOMER_STATE, SALES_INVOICE_STATE } from '@herobm/shared';

describe('CustomerStatementService', () => {
  let service: CustomerStatementService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn(),
    };
    service = new CustomerStatementService(mockDb);
  });

  it('should throw NotFoundException if customer does not exist', async () => {
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        leftJoin: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    });

    await expect(service.assembleData('non-existent-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should assemble customer statement with chronological ledger and aging summary', async () => {
    const customerHeader = {
      customerId: 'cust-1',
      customerNumber: 'CUST-001',
      currencyCode: 'AUD',
      creditLimit: '10000.00',
      stateCode: CUSTOMER_STATE.ACTIVE,
      termsDescription: 'Net 30 Days',
      termsCode: 'NET30',
      name: 'Acme Commercial Pty Ltd',
      headquartersAddressLine1: '100 Flinders Street',
      city: 'Melbourne',
      stateOrProvince: 'VIC',
      postalCode: '3000',
      country: 'Australia',
    };

    const invoices = [
      {
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-1001',
        invoiceDate: new Date('2026-08-01T00:00:00Z'),
        dueDate: new Date('2026-08-31T00:00:00Z'),
        totalAmount: '1200.00',
        outstandingAmount: '200.00',
        stateCode: 'posted',
        createdOn: new Date('2026-08-01T00:00:00Z'),
      },
      {
        invoiceId: 'inv-2',
        invoiceNumber: 'INV-1002',
        invoiceDate: new Date('2026-08-10T00:00:00Z'),
        dueDate: new Date('2026-09-10T00:00:00Z'),
        totalAmount: '800.00',
        outstandingAmount: '800.00',
        stateCode: 'posted',
        createdOn: new Date('2026-08-10T00:00:00Z'),
      },
    ];

    const creditNotes = [
      {
        creditNoteId: 'cn-1',
        creditNoteNumber: 'CR-501',
        totalAmount: '200.00',
        outstandingAmount: '0.00',
        stateCode: 'posted',
        createdOn: new Date('2026-08-05T00:00:00Z'),
      },
    ];

    const payments = [
      {
        paymentId: 'pmt-1',
        paymentNumber: 'PMT-801',
        paymentDate: new Date('2026-08-15T00:00:00Z'),
        modeOfPayment: 'EFT',
        totalAmount: '800.00',
        createdOn: new Date('2026-08-15T00:00:00Z'),
      },
    ];

    const bankAccount = {
      accountName: 'Operating Bank Account',
      metadata: {
        bankName: 'National Australia Bank',
        bsb: '083-004',
        accountNumber: '123456789',
      },
    };

    // 1. Mock customer header query
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        leftJoin: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([customerHeader]),
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

    // 2. Mock invoices query
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue(invoices),
        }),
      }),
    });

    // 3. Mock credit notes query
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue(creditNotes),
        }),
      }),
    });

    // 4. Mock payments query
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue(payments),
        }),
      }),
    });

    // 5. Mock bank account query
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([bankAccount]),
        }),
      }),
    });

    const result = await service.assembleData('cust-1', {
      customPdfText: 'Thank you for your prompt payments.',
    });

    expect(result.header.customerNumber).toBe('CUST-001');
    expect(result.header.customerName).toBe('Acme Commercial Pty Ltd');
    expect(result.header.currencyCode).toBe('AUD');
    expect(result.lines.length).toBe(4);
    expect(result.bank.bankName).toBe('National Australia Bank');
    expect(result.customPdfText).toBe('Thank you for your prompt payments.');
  });
});

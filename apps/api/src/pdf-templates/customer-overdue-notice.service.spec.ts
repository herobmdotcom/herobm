import { CustomerOverdueNoticeService } from './customer-overdue-notice.service';
import { NotFoundException } from '@nestjs/common';
import { CUSTOMER_STATE } from '@herobm/shared';

describe('CustomerOverdueNoticeService', () => {
  let service: CustomerOverdueNoticeService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn(),
    };
    service = new CustomerOverdueNoticeService(mockDb);
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

  it('should assemble overdue notice with filtered past-due invoices and aging breakdown', async () => {
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

    const pastDueDate1 = new Date();
    pastDueDate1.setDate(pastDueDate1.getDate() - 15); // 15 days overdue

    const pastDueDate2 = new Date();
    pastDueDate2.setDate(pastDueDate2.getDate() - 45); // 45 days overdue

    const futureDueDate = new Date();
    futureDueDate.setDate(futureDueDate.getDate() + 10); // not overdue

    const invoices = [
      {
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-1001',
        customerOrderNumber: 'PO-991',
        invoiceDate: new Date('2026-07-01T00:00:00Z'),
        dueDate: pastDueDate1,
        totalAmount: '1200.00',
        outstandingAmount: '500.00',
        stateCode: 'posted',
        createdOn: new Date('2026-07-01T00:00:00Z'),
      },
      {
        invoiceId: 'inv-2',
        invoiceNumber: 'INV-1002',
        customerOrderNumber: 'PO-992',
        invoiceDate: new Date('2026-06-01T00:00:00Z'),
        dueDate: pastDueDate2,
        totalAmount: '800.00',
        outstandingAmount: '800.00',
        stateCode: 'posted',
        createdOn: new Date('2026-06-01T00:00:00Z'),
      },
      {
        invoiceId: 'inv-3',
        invoiceNumber: 'INV-1003',
        customerOrderNumber: 'PO-993',
        invoiceDate: new Date('2026-08-01T00:00:00Z'),
        dueDate: futureDueDate,
        totalAmount: '300.00',
        outstandingAmount: '300.00',
        stateCode: 'posted',
        createdOn: new Date('2026-08-01T00:00:00Z'),
      },
    ];

    const bankAccount = {
      accountName: 'Operating Account',
      metadata: {
        bankName: 'Commonwealth Bank',
        bsb: '063-000',
        accountNumber: '12345678',
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

    // 2. Mock invoices query
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue(invoices),
        }),
      }),
    });

    // 3. Mock bank account query
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([bankAccount]),
        }),
      }),
    });

    const result = await service.assembleData('cust-1', {
      customPdfText: 'Please settle the overdue amount immediately.',
    });

    expect(result.header.customerName).toBe('Acme Commercial Pty Ltd');
    expect(result.header.customerNumber).toBe('CUST-001');
    expect(result.header.billingAddress).toBe(
      '100 Flinders Street, Melbourne, VIC, 3000, Australia',
    );
    expect(result.header.noticeLevel).toBe('Second Notice');
    expect(result.header.noticeTitle).toBe('OVERDUE PAYMENT NOTICE');

    // Only overdue invoices should be in lines
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].invoiceNumber).toBe('INV-1001');
    expect(result.lines[0].overdueAmount).toBe('500.00');
    expect(result.lines[1].invoiceNumber).toBe('INV-1002');
    expect(result.lines[1].overdueAmount).toBe('800.00');

    // Aging breakdown
    expect(result.aging.current).toBe('300.00');
    expect(result.aging.days1To30).toBe('500.00');
    expect(result.aging.days31To60).toBe('800.00');

    // Summary
    expect(result.summary.totalOverdue).toBe('1300.00');
    expect(result.summary.totalOutstanding).toBe('1600.00');
    expect(result.summary.overdueInvoiceCount).toBe(2);
    expect(result.summary.maxDaysOverdue).toBeGreaterThanOrEqual(45);

    // Bank & Custom text
    expect(result.bank.bankName).toBe('Commonwealth Bank');
    expect(result.bank.bsb).toBe('063-000');
    expect(result.bank.accountNumber).toBe('12345678');
    expect(result.customPdfText).toBe(
      'Please settle the overdue amount immediately.',
    );
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { SalesInvoiceService } from './sales-invoice.service';
import { OrdersService } from '../orders/orders.service';
import { OrdersWriteService } from '../orders/orders-write.service';
import { ReportService } from './report.service';

describe('SalesInvoiceService', () => {
  let service: SalesInvoiceService;
  let ordersService: OrdersService;
  let ordersWriteService: OrdersWriteService;
  let reportService: ReportService;
  let mockCompilePdf: jest.Mock;

  const mockOrder = {
    salesOrderId: 'order-1',
    orderNumber: 'ORD-001',
    customerName: 'Test Customer',
    customerOrderNumber: 'PO-123',
    createdOn: new Date(),
    currencyCode: 'EUR',
    name: 'Test Order',
    lines: [
      {
        lineNumber: 1,
        productId: 'prod-1',
        productNumber: 'P001',
        productDescription: 'Product 1',
        quantity: '2',
        pricePerUnit: '10.00',
        amount: '20.00',
        tax: '4.00',
        totalAmount: '24.00',
        unitOfMeasure: 'EA',
      },
    ],
  };

  beforeEach(async () => {
    mockCompilePdf = jest.fn().mockResolvedValue(Buffer.from('PDF_CONTENT'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesInvoiceService,
        {
          provide: OrdersService,
          useValue: {
            findAbmOrder: jest.fn().mockResolvedValue(mockOrder),
          },
        },
        {
          provide: OrdersWriteService,
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockOrder),
          },
        },
        {
          provide: ReportService,
          useValue: {
            compilePdf: mockCompilePdf,
          },
        },
      ],
    }).compile();

    service = module.get<SalesInvoiceService>(SalesInvoiceService);
    ordersService = module.get<OrdersService>(OrdersService);
    ordersWriteService = module.get<OrdersWriteService>(OrdersWriteService);
    reportService = module.get<ReportService>(ReportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate sales invoice PDF', async () => {
    const result = await service.generateSalesInvoice('order-1', 'app');

    expect(result.pdf.toString()).toBe('PDF_CONTENT');
    expect(result.orderNumber).toBe('ORD-001');
    expect(mockCompilePdf).toHaveBeenCalled();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { SalesQuoteService } from './sales-quote.service';
import { OrdersService } from '../orders/orders.service';
import { OrdersWriteService } from '../orders/orders-write.service';
import { ReportService } from './report.service';

describe('SalesQuoteService', () => {
  let service: SalesQuoteService;
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
        SalesQuoteService,
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

    service = module.get<SalesQuoteService>(SalesQuoteService);
    ordersService = module.get<OrdersService>(OrdersService);
    ordersWriteService = module.get<OrdersWriteService>(OrdersWriteService);
    reportService = module.get<ReportService>(ReportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should assemble data correctly', async () => {
    const data = await service.assembleData('order-1', 'app');

    expect(data.header.orderNumber).toBe('ORD-001');
    expect(data.lines).toHaveLength(1);
    expect(data.lines[0].productNumber).toBe('P001');
    expect(data.summary.subtotal).toBe(20);
    expect(data.summary.totalTax).toBe(4);
    expect(data.summary.totalAmount).toBe(24);
  });

  it('should generate sales quote PDF', async () => {
    const result = await service.generateSalesQuote('order-1', 'app');

    expect(result.pdf.toString()).toBe('PDF_CONTENT');
    expect(result.orderNumber).toBe('ORD-001');
    expect(mockCompilePdf).toHaveBeenCalled();
  });
});

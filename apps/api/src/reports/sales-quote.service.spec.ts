import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { SalesQuoteService } from './sales-quote.service';
import { OrdersService } from '../orders/orders.service';
import { OrdersWriteService } from '../orders/orders-write.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { AppConfigService } from '../settings/app-config.service';

describe('SalesQuoteService', () => {
  let service: SalesQuoteService;
  let ordersService: OrdersService;
  let ordersWriteService: OrdersWriteService;

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
        discountPercentage: '0',
        taxCategoryId: 'tax-cat-1',
        amount: '20.00',
        tax: '4.00',
        totalAmount: '24.00',
        unitOfMeasure: 'EA',
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: ConfigService, useValue: { get: jest.fn() } },
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
          provide: DRIZZLE,
          useValue: {
            select: () => ({
              from: () =>
                Promise.resolve([{ taxCategoryId: 'tax-cat-1', rate: '20' }]),
            }),
          },
        },
        {
          provide: AppConfigService,
          useValue: { homeCurrency: jest.fn().mockReturnValue('EUR') },
        },
      ],
    }).compile();

    service = module.get<SalesQuoteService>(SalesQuoteService);
    ordersService = module.get<OrdersService>(OrdersService);
    ordersWriteService = module.get<OrdersWriteService>(OrdersWriteService);
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
});

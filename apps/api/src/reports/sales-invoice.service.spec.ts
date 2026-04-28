import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { SalesInvoiceService } from './sales-invoice.service';
import { OrdersService } from '../orders/orders.service';
import { OrdersWriteService } from '../orders/orders-write.service';
import { DRIZZLE } from '../drizzle/drizzle.module';

describe('SalesInvoiceService', () => {
  let service: SalesInvoiceService;
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
          provide: DRIZZLE,
          useValue: {
            select: () => ({
              from: () =>
                Promise.resolve([{ taxCategoryId: 'tax-cat-1', rate: '20' }]),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SalesInvoiceService>(SalesInvoiceService);
    ordersService = module.get<OrdersService>(OrdersService);
    ordersWriteService = module.get<OrdersWriteService>(OrdersWriteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

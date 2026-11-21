import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { OrdersQueryService } from '../orders/orders-query.service';
import { OrdersService } from '../orders/orders.service';
import { AppConfigService } from '../settings/app-config.service';
import { SalesInvoiceService } from './sales-invoice.service';

describe('SalesInvoiceService', () => {
  let service: SalesInvoiceService;
  let ordersService: OrdersService;
  let ordersQueryService: OrdersQueryService;
  let dbMock: any;

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

  const createChain = (result: any) => {
    const chain: any = {
      from: jest.fn(() => chain),
      leftJoin: jest.fn(() => chain),
      innerJoin: jest.fn(() => chain),
      where: jest.fn(() => chain),
      orderBy: jest.fn(() => chain),
      then: (resolve: any, reject?: any) =>
        Promise.resolve(result).then(resolve, reject),
    };
    return chain;
  };

  beforeEach(async () => {
    dbMock = {
      select: jest.fn(() =>
        createChain([{ taxCategoryId: 'tax-cat-1', rate: '20' }]),
      ),
    };

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
          provide: OrdersQueryService,
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockOrder),
          },
        },
        {
          provide: DRIZZLE,
          useValue: dbMock,
        },
        {
          provide: AppConfigService,
          useValue: { homeCurrency: jest.fn().mockReturnValue('EUR') },
        },
      ],
    }).compile();

    service = module.get<SalesInvoiceService>(SalesInvoiceService);
    ordersService = module.get<OrdersService>(OrdersService);
    ordersQueryService = module.get<OrdersQueryService>(OrdersQueryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should pass customPdfText option to output data', async () => {
    const data = await service.assembleData('order-1', 'app', undefined, {
      customPdfText: 'Payment due upon receipt.',
    });

    expect(data.customPdfText).toBe('Payment due upon receipt.');
  });

  it('should format and include customerAddress and billingAddress in header', async () => {
    jest.spyOn(ordersQueryService, 'findOne').mockResolvedValueOnce({
      ...mockOrder,
      customerAddressLine1: '100 King St',
      customerAddressLine2: 'Level 5',
      customerCity: 'Sydney',
      customerState: 'NSW',
      customerPostalCode: '2000',
      customerCountry: 'Australia',
    } as any);

    const data = await service.assembleData('order-1', 'app');

    expect(data.header.customerAddress).toBe(
      '100 King St, Level 5, Sydney NSW 2000, Australia',
    );
    expect(data.header.billingAddress).toBe(
      '100 King St, Level 5, Sydney NSW 2000, Australia',
    );
  });

  it('should fallback to delivery address if customer headquarters address is absent', async () => {
    jest.spyOn(ordersQueryService, 'findOne').mockResolvedValueOnce({
      ...mockOrder,
      deliveryAddressLine1: '42 Wallaby Way',
      deliveryCity: 'Sydney',
      deliveryCountry: 'Australia',
    } as any);

    const data = await service.assembleData('order-1', 'app');

    expect(data.header.customerAddress).toBe(
      '42 Wallaby Way, Sydney, Australia',
    );
  });

  it('should assemble invoice data directly from sales_invoice_lines document of record (ADV-237)', async () => {
    const mockInvoiceHeader = {
      invoiceId: 'inv-123',
      invoiceNumber: 'SI-29746',
      salesOrderId: 'order-1',
      orderNumber: 'SS9418',
      orderCustomerOrderNumber: 'DANNY',
      orderTotalAmount: '14244.32',
      customerOrderNumber: 'DANNY',
      customerName: 'WRIGHT STEEL CONSTRUCTION',
      customerAddressLine1: '3-5 Begg Drive',
      customerCity: 'Jindera',
      customerState: 'NSW',
      customerPostalCode: '2642',
      customerCountry: 'Australia',
      currencyCode: 'AUD',
      invoiceDate: new Date('2026-10-09'),
      dueDate: new Date('2026-11-30'),
      createdOn: new Date('2026-10-09'),
      totalAmount: '4502.60',
      taxAmount: '0.00',
    };

    const mockLinesRaw = [
      {
        lineId: 'line-1',
        quantityInvoiced: '20',
        pricePerUnit: '150.00',
        amount: '3000.00',
        taxAmount: '0.00',
        discountPercentage: '0',
        unitOfMeasure: 'EA',
        productId: 'prod-mlfitter',
        productNumber: 'MLFITTER',
        description: 'HYDRAULIC FITTER',
      },
      {
        lineId: 'line-2',
        quantityInvoiced: '10',
        pricePerUnit: '150.00',
        amount: '1500.00',
        taxAmount: '0.00',
        discountPercentage: '0',
        unitOfMeasure: 'EA',
        productId: 'prod-eofitter',
        productNumber: 'EOFITTER',
        description: 'HYDRAULIC FITTER',
      },
      {
        lineId: 'line-3',
        quantityInvoiced: '2',
        pricePerUnit: '1.30',
        amount: '2.60',
        taxAmount: '0.00',
        discountPercentage: '0',
        unitOfMeasure: 'EA',
        productId: 'prod-r0220',
        productNumber: 'R0220',
        description: 'O RING TO SUIT 1-1/4 SAE FL BS222-N9',
      },
    ];

    const mockOrderInvoices = [{ invoiceId: 'inv-123' }];

    dbMock.select
      .mockReturnValueOnce(createChain([mockInvoiceHeader]))
      .mockReturnValueOnce(createChain(mockLinesRaw))
      .mockReturnValueOnce(createChain(mockOrderInvoices));

    const result = await service.assembleInvoiceData('inv-123');

    // Header checks
    expect(result.header.orderNumber).toBe('SS9418');
    expect(result.header.customerName).toBe('WRIGHT STEEL CONSTRUCTION');
    expect(result.header.customerOrderNumber).toBe('DANNY');
    expect(result.invoiceMeta?.invoiceNumber).toBe('SI-29746');
    expect(result.invoiceMeta?.sequenceNumber).toBe(1);
    expect(result.invoiceMeta?.totalInvoices).toBe(1);

    // Line checks: Assert lines retain their native descriptions, codes, and prices
    expect(result.lines).toHaveLength(3);
    expect(result.lines[0]).toMatchObject({
      lineNumber: 1,
      productNumber: 'MLFITTER',
      description: 'HYDRAULIC FITTER',
      quantity: '20',
      pricePerUnit: '150.00',
      amount: '3000.00',
    });
    expect(result.lines[1]).toMatchObject({
      lineNumber: 2,
      productNumber: 'EOFITTER',
      description: 'HYDRAULIC FITTER',
      quantity: '10',
      pricePerUnit: '150.00',
      amount: '1500.00',
    });
    expect(result.lines[2]).toMatchObject({
      lineNumber: 3,
      productNumber: 'R0220',
      description: 'O RING TO SUIT 1-1/4 SAE FL BS222-N9',
      quantity: '2',
      pricePerUnit: '1.30',
      amount: '2.60',
    });

    // Summary checks
    expect(result.summary.subtotal).toBe(4502.6);
    expect(result.summary.totalAmount).toBe(4502.6);
  });

  it('assembleData with invoiceId delegates to assembleInvoiceData', async () => {
    const spy = jest
      .spyOn(service, 'assembleInvoiceData')
      .mockResolvedValueOnce({ header: { orderNumber: 'SS9418' } } as any);

    const result = await service.assembleData('order-1', 'app', 'inv-123');
    expect(spy).toHaveBeenCalledWith('inv-123', undefined);
    expect(result.header.orderNumber).toBe('SS9418');
  });

  it('throws NotFoundException if invoice does not exist', async () => {
    dbMock.select.mockReturnValueOnce(createChain([]));
    await expect(
      service.assembleInvoiceData('inv-nonexistent'),
    ).rejects.toThrow(NotFoundException);
  });
});

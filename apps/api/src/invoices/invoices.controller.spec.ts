import { Test, TestingModule } from '@nestjs/testing';
import {
  SalesInvoiceController,
  PurchaseInvoiceController,
  InvoiceDetailController,
} from './invoices.controller';
import { SalesInvoiceService } from './sales-invoice.service';
import { PurchaseInvoiceCoreService } from './purchase-invoice-core.service';
import { PurchaseInvoiceDraftService } from './purchase-invoice-draft.service';
import { PurchaseInvoicePostingService } from './purchase-invoice-posting.service';

describe('Invoices Controllers', () => {
  let salesController: SalesInvoiceController;
  let purchaseController: PurchaseInvoiceController;
  let detailController: InvoiceDetailController;

  let mockSalesService: Partial<Record<keyof SalesInvoiceService, jest.Mock>>;
  let mockPurchaseCoreService: Partial<
    Record<keyof PurchaseInvoiceCoreService, jest.Mock>
  >;
  let mockPurchaseDraftService: Partial<
    Record<keyof PurchaseInvoiceDraftService, jest.Mock>
  >;
  let mockPurchasePostingService: Partial<
    Record<keyof PurchaseInvoicePostingService, jest.Mock>
  >;

  beforeEach(async () => {
    mockSalesService = {
      createInvoice: jest.fn().mockResolvedValue({ id: 'si-1' }),
      findByOrder: jest.fn().mockResolvedValue([{ id: 'si-1' }]),
      findOne: jest.fn().mockResolvedValue({ id: 'si-1', total: 100 }),
      findActiveInvoices: jest.fn().mockResolvedValue([{ id: 'si-1' }]),
    };

    mockPurchaseCoreService = {
      findByOrder: jest.fn().mockResolvedValue([{ id: 'pi-1' }]),
      findOne: jest.fn().mockResolvedValue({ id: 'pi-1', total: 200 }),
    };

    mockPurchaseDraftService = {};
    mockPurchasePostingService = {};

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        SalesInvoiceController,
        PurchaseInvoiceController,
        InvoiceDetailController,
      ],
      providers: [
        { provide: SalesInvoiceService, useValue: mockSalesService },
        {
          provide: PurchaseInvoiceCoreService,
          useValue: mockPurchaseCoreService,
        },
        {
          provide: PurchaseInvoiceDraftService,
          useValue: mockPurchaseDraftService,
        },
        {
          provide: PurchaseInvoicePostingService,
          useValue: mockPurchasePostingService,
        },
      ],
    }).compile();

    salesController = module.get<SalesInvoiceController>(
      SalesInvoiceController,
    );
    purchaseController = module.get<PurchaseInvoiceController>(
      PurchaseInvoiceController,
    );
    detailController = module.get<InvoiceDetailController>(
      InvoiceDetailController,
    );
  });

  describe('SalesInvoiceController', () => {
    it('should create a sales invoice', async () => {
      const dto = { lines: [] } as unknown as Parameters<
        SalesInvoiceController['createSalesInvoice']
      >[1];
      const req = { user: { username: 'test-user' } };

      const result = await salesController.createSalesInvoice(
        'order-1',
        dto,
        req,
      );

      expect(result).toEqual({ id: 'si-1' });
      expect(mockSalesService.createInvoice).toHaveBeenCalledWith(
        'order-1',
        dto,
        'test-user',
      );
    });

    it('should create a sales invoice with fallback actor if user missing', async () => {
      const result = await salesController.createSalesInvoice(
        'order-1',
        {} as unknown as Parameters<
          SalesInvoiceController['createSalesInvoice']
        >[1],
        {},
      );
      expect(mockSalesService.createInvoice).toHaveBeenCalledWith(
        'order-1',
        {},
        'system',
      );
    });

    it('should get sales invoices by order ID', async () => {
      const result = await salesController.getSalesInvoices('order-1');
      expect(result).toEqual([{ id: 'si-1' }]);
      expect(mockSalesService.findByOrder).toHaveBeenCalledWith('order-1');
    });
  });

  describe('PurchaseInvoiceController', () => {
    it('should get purchase bills by order ID', async () => {
      const result = await purchaseController.getPurchaseBills('p-order-1');
      expect(result).toEqual([{ id: 'pi-1' }]);
      expect(mockPurchaseCoreService.findByOrder).toHaveBeenCalledWith(
        'p-order-1',
      );
    });
  });

  describe('InvoiceDetailController', () => {
    it('should get sales invoice details by ID', async () => {
      const result = await detailController.getSalesInvoiceDetails('si-1');
      expect(result).toEqual({ id: 'si-1', total: 100 });
      expect(mockSalesService.findOne).toHaveBeenCalledWith('si-1');
    });

    it('should get global active sales invoices with parsed queries', async () => {
      const result = await detailController.getSalesInvoicesGlobal(
        { limit: 50 },
        '30',
        'acc-1',
        'inv-1',
        undefined,
      );

      expect(result).toEqual([{ id: 'si-1' }]);
      expect(mockSalesService.findActiveInvoices).toHaveBeenCalledWith({
        days: 30,
        customerId: 'acc-1',
        invoiceId: 'inv-1',
        limit: 50,
        cursor: null,
        direction: 'next',
        balanceStatus: undefined,
        searchTerm: null,
      });
    });

    it('should get global active sales invoices without queries', async () => {
      const result = await detailController.getSalesInvoicesGlobal({});

      expect(result).toEqual([{ id: 'si-1' }]);
      expect(mockSalesService.findActiveInvoices).toHaveBeenCalledWith({
        days: undefined,
        customerId: undefined,
        invoiceId: undefined,
        limit: 50, // parsePagination defaults to 50
        cursor: null,
        direction: 'next',
        balanceStatus: undefined,
        searchTerm: null,
      });
    });

    it('should get purchase bill details by ID', async () => {
      const result = await detailController.getPurchaseBillDetails('pi-1');
      expect(result).toEqual({ id: 'pi-1', total: 200 });
      expect(mockPurchaseCoreService.findOne).toHaveBeenCalledWith('pi-1');
    });
  });
});

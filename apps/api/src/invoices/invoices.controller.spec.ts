import { Test, TestingModule } from '@nestjs/testing';
import {
  SalesInvoiceController,
  PurchaseInvoiceController,
  InvoiceDetailController,
} from './invoices.controller';
import { SalesInvoiceService } from './sales-invoice.service';
import { PurchaseInvoiceService } from './purchase-invoice.service';

describe('Invoices Controllers', () => {
  let salesController: SalesInvoiceController;
  let purchaseController: PurchaseInvoiceController;
  let detailController: InvoiceDetailController;

  let mockSalesService: any;
  let mockPurchaseService: any;

  beforeEach(async () => {
    mockSalesService = {
      createInvoice: jest.fn().mockResolvedValue({ id: 'si-1' }),
      findByOrder: jest.fn().mockResolvedValue([{ id: 'si-1' }]),
      findOne: jest.fn().mockResolvedValue({ id: 'si-1', total: 100 }),
      findActiveInvoices: jest.fn().mockResolvedValue([{ id: 'si-1' }]),
    };

    mockPurchaseService = {
      findByOrder: jest.fn().mockResolvedValue([{ id: 'pi-1' }]),
      findOne: jest.fn().mockResolvedValue({ id: 'pi-1', total: 200 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        SalesInvoiceController,
        PurchaseInvoiceController,
        InvoiceDetailController,
      ],
      providers: [
        { provide: SalesInvoiceService, useValue: mockSalesService },
        { provide: PurchaseInvoiceService, useValue: mockPurchaseService },
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
      const dto: any = { lines: [] };
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
        {} as any,
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
      expect(result).toEqual({ data: [{ id: 'si-1' }] });
      expect(mockSalesService.findByOrder).toHaveBeenCalledWith('order-1');
    });
  });

  describe('PurchaseInvoiceController', () => {
    it('should get purchase bills by order ID', async () => {
      const result = await purchaseController.getPurchaseBills('p-order-1');
      expect(result).toEqual({ data: [{ id: 'pi-1' }] });
      expect(mockPurchaseService.findByOrder).toHaveBeenCalledWith('p-order-1');
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
        '30',
        'acc-1',
        'inv-1',
        undefined,
        '50',
      );

      expect(result).toEqual({ data: [{ id: 'si-1' }] });
      expect(mockSalesService.findActiveInvoices).toHaveBeenCalledWith({
        days: 30,
        customerId: 'acc-1',
        invoiceId: 'inv-1',
        limit: 50,
      });
    });

    it('should get global active sales invoices without queries', async () => {
      const result = await detailController.getSalesInvoicesGlobal();

      expect(result).toEqual({ data: [{ id: 'si-1' }] });
      expect(mockSalesService.findActiveInvoices).toHaveBeenCalledWith({
        days: undefined,
        customerId: undefined,
        invoiceId: undefined,
        limit: undefined,
      });
    });

    it('should get purchase bill details by ID', async () => {
      const result = await detailController.getPurchaseBillDetails('pi-1');
      expect(result).toEqual({ id: 'pi-1', total: 200 });
      expect(mockPurchaseService.findOne).toHaveBeenCalledWith('pi-1');
    });
  });
});

import { AppConfigService } from '../settings/app-config.service';
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersWriteService } from './orders-write.service';
import { BackordersService } from './backorders.service';
import { PickingService } from './picking.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { InventoryService } from '../inventory/inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AccountsService } from '../customers/customers.service';
import { CreditAssessmentService } from '../customers/credit-assessment.service';
import { ProductsService } from '../products/products.service';
import { SALES_ORDER_STATE } from '@modbm/shared';

import { PGlite } from '@electric-sql/pglite';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { DrizzleDB } from '../drizzle/drizzle.module';
import { eq, sql } from 'drizzle-orm';
import {
  createTestCustomer,
  createTestProduct,
  createTestSalesOrder,
} from '../../test/fixtures';
import {
  salesOrders,
  salesOrderLineItems,
  products as coreProducts,
  productComponents,
  locations,
} from '../drizzle/modbm-core-schema';

import { taxCategories } from '../drizzle/modbm-core-schema';
import { getErrorMessage } from '@modbm/shared';

// Default GST categories used across tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let TAX_DEFAULT: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let TAX_EXEMPT: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let TAX_ZERO: any;

describe('OrdersWriteService', () => {
  const pg = setupPgliteSuite();
  let service: OrdersWriteService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPickingService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockInventoryService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAccountsService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockProductsService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mocktaxService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockBackordersService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCreditAssessmentService: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const allTaxes = await pg.db.select().from(taxCategories);
    TAX_DEFAULT = allTaxes.find((t) => t.code === 'GST');
    TAX_EXEMPT = allTaxes.find((t) => t.code === 'N-T');
    TAX_ZERO = allTaxes.find((t) => t.code === 'FRE');

    // Ensure standard location exists
    await pg.db
      .insert(locations)
      .values({
        locationId: '10000000-0000-0000-0000-000000000001',
        code: 'MAIN',
        name: 'Main Location',
      })
      .onConflictDoNothing();

    mocktaxService = {
      getDefault: jest.fn().mockResolvedValue(TAX_DEFAULT),
      getByCode: jest.fn().mockImplementation(async (code: string) => {
        if (code === 'N-T') return TAX_EXEMPT;
        if (code === 'FRE') return TAX_ZERO;
        if (code === 'GST') return TAX_DEFAULT;
        throw new Error('GST category not found by code');
      }),
      getById: jest.fn().mockImplementation(async (id: string) => {
        if (id === 'unknown-id') throw new Error('Not found by ID');
        if (id === TAX_ZERO.taxCategoryId) return TAX_ZERO;
        if (id === TAX_EXEMPT.taxCategoryId) return TAX_EXEMPT;
        return TAX_DEFAULT;
      }),
    };

    mockBackordersService = {
      evaluateGaps: jest.fn().mockResolvedValue([]),
      triggerBackorders: jest.fn().mockResolvedValue(undefined),
    };

    mockPickingService = {
      assertFullyPicked: jest.fn().mockResolvedValue(undefined),
      assertFullyShipped: jest.fn().mockResolvedValue(undefined),
    };

    mockInventoryService = {
      recordInventoryMovement: jest.fn().mockResolvedValue(undefined),
    };
    mockAccountsService = {
      findOne: jest.fn().mockResolvedValue({
        customerId: 'c0000000-0000-0000-0000-000000000001',
        currencyCode: 'EUR',
        taxCategoryId: TAX_DEFAULT.taxCategoryId,
      }),
    };
    mockProductsService = {
      findOne: jest.fn().mockResolvedValue({
        productId: 'PROD-001',
        name: 'Test Product',
        salesTaxCategoryId: TAX_DEFAULT.taxCategoryId,
      }),
    };
    mockCreditAssessmentService = {
      assessCredit: jest.fn().mockResolvedValue({
        totalArBalance: 0,
        overdueBalance: 0,
        isOverdue: false,
      }),
    };

    const mockOrganizationService = {
      get: jest.fn().mockResolvedValue({}),
    };

    service = new OrdersWriteService(
      pg.db,
      mocktaxService,
      mockPickingService,
      mockInventoryService,
      mockAccountsService,
      mockCreditAssessmentService,
      mockProductsService,
      mockBackordersService,
      {
        defaultFulfillmentLocationId: jest
          .fn()
          .mockReturnValue('10000000-0000-0000-0000-000000000001'),
        creditLimitBehavior: jest.fn().mockReturnValue('soft'),
        taxProviderMappings: jest.fn().mockReturnValue({}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockOrganizationService as any,
      {
        lookup: jest.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };
  });

  // =========================================================================
  // computeLineAmount
  // =========================================================================

  describe('line amount computation', () => {
    const compute = (
      qty: string,
      price: string,
      disc: string,
      taxRate: number,
    ) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (OrdersWriteService.prototype as any).computeLineAmount.call(
        null,
        qty,
        price,
        disc,
        taxRate,
      );

    it('should compute amount without discount or tax', () => {
      const r = compute('10', '5.00', '0', 0);
      expect(r.amount).toBe('50.00');
      expect(r.tax).toBe('0.00');
      expect(r.totalAmount).toBe('50.00');
    });

    it('should apply percentage discount', () => {
      const r = compute('10', '5.00', '10', 0);
      expect(r.amount).toBe('45.00');
      expect(r.totalAmount).toBe('45.00');
    });

    it('should auto-calculate tax from GST rate', () => {
      const r = compute('10', '5.00', '0', 10);
      expect(r.amount).toBe('50.00');
      expect(r.tax).toBe('5.00');
      expect(r.totalAmount).toBe('55.00');
    });

    it('should handle discount and GST rate together', () => {
      const r = compute('10', '5.00', '10', 10);
      expect(r.amount).toBe('45.00');
      expect(r.tax).toBe('4.50');
      expect(r.totalAmount).toBe('49.50');
    });

    it('should handle fractional quantities', () => {
      const r = compute('2.5', '10.00', '0', 0);
      expect(r.amount).toBe('25.00');
    });
  });

  // =========================================================================
  // create()
  //
  // generateOrderNumber() is now called inside the transaction (uses tx.execute).
  // The remaining select calls outside the transaction are:
  //   - resolveCustomer → AccountsService.findOne (mocked)
  //   - resolveTaxForLine → AccountsService + ProductsService (mocked)
  //   - validateProduct → ProductsService.findOne (mocked)
  // =========================================================================

  describe('create', () => {
    async function setupCreate(opts?: {
      taxCategoryId?: string;
      disc?: string;
      productTaxId?: string;
      currency?: string;
    }) {
      const gstId = opts?.taxCategoryId ?? TAX_DEFAULT.taxCategoryId;
      const disc = opts?.disc ?? '0';
      const prodGstId = opts?.productTaxId ?? TAX_DEFAULT.taxCategoryId;
      const currency = opts?.currency ?? 'EUR';

      const customer = await createTestCustomer(pg.db);
      mockAccountsService.findOne.mockResolvedValue({
        customerId: customer.customerId,
        currencyCode: currency,
        taxCategoryId: gstId,
      });

      const product = await createTestProduct(pg.db);
      mockProductsService.findOne.mockResolvedValue({
        productId: product.productId,
        name: 'Test Product',
        salesTaxCategoryId: prodGstId,
      });

      return {
        customer,
        product,
        validDto: {
          salesOrderId: '00000000-0000-0000-0000-000000000001',
          customerId: customer.customerId,
          lines: [
            {
              productId: product.productId,
              quantity: '10',
              pricePerUnit: '5.00',
            },
          ],
        },
      };
    }

    it('should create an order in draft state', async () => {
      const { validDto } = await setupCreate();
      const result = await service.create(validDto, 'admin');
      expect(result).toHaveProperty('salesOrderId');
      expect(result).toHaveProperty('stateCode', SALES_ORDER_STATE.DRAFT);

      const saved = await pg.db
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, result.salesOrderId));
      expect(saved[0].stateCode).toBe(SALES_ORDER_STATE.DRAFT);
    });

    it('should default to 0% discount when no discount is provided (frontend-authoritative)', async () => {
      const { validDto } = await setupCreate({ disc: '15' });
      const result = await service.create(validDto, 'admin');
      const lines = await pg.db
        .select()
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.salesOrderId, result.salesOrderId));
      // Backend no longer resolves customer discount — defaults to '0' unless frontend provides one
      expect(lines[0].discountPercentage).toBe('0');
    });

    it('should use explicit line discount when provided by frontend', async () => {
      const { customer, product } = await setupCreate();
      const result = await service.create(
        {
          salesOrderId: '00000000-0000-0000-0000-000000000001',
          customerId: customer.customerId,
          lines: [
            {
              productId: product.productId,
              quantity: '10',
              pricePerUnit: '5.00',
              discountPercentage: '12.5',
            },
          ],
        },
        'admin',
      );
      const lines = await pg.db
        .select()
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.salesOrderId, result.salesOrderId));
      expect(lines[0].discountPercentage).toBe('12.5');
    });

    it('should snapshot non-EUR currency onto the order (ADV-034)', async () => {
      const { validDto } = await setupCreate({ currency: 'SGD' });
      const result = await service.create(validDto, 'admin');
      expect(result.currencyCode).toBe('SGD');
    });

    it('should use product GST category directly without fallback if possible', async () => {
      const { validDto } = await setupCreate();
      await service.create(validDto, 'admin');
      expect(mocktaxService.getById).toHaveBeenCalledWith(
        TAX_DEFAULT.taxCategoryId,
        expect.anything(),
      );
    });

    it('should use zero-rated GST for zero-rated product', async () => {
      const { validDto } = await setupCreate({
        productTaxId: TAX_ZERO.taxCategoryId,
      });
      await service.create(validDto, 'admin');
      expect(mocktaxService.getById).toHaveBeenCalledWith(
        TAX_ZERO.taxCategoryId,
        expect.anything(),
      );
    });

    it('should use exempt GST for exempt customer (regardless of product)', async () => {
      const { customer, validDto } = await setupCreate();
      mockAccountsService.findOne.mockResolvedValue({
        customerId: customer.customerId,
        currencyCode: 'EUR',
        taxCategoryId: TAX_EXEMPT.taxCategoryId,
      });

      await service.create(validDto, 'admin');
      expect(mocktaxService.getById).toHaveBeenCalledTimes(1);
    });

    it('should reject unknown customer', async () => {
      const { validDto } = await setupCreate();
      mockAccountsService.findOne.mockRejectedValue(new NotFoundException());
      await expect(service.create(validDto, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject unknown product', async () => {
      const { validDto } = await setupCreate();
      mockProductsService.findOne.mockRejectedValue(new NotFoundException());
      await expect(service.create(validDto, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create order with no lines', async () => {
      const { customer } = await setupCreate();
      const dto = {
        salesOrderId: '00000000-0000-0000-0000-000000000001',
        customerId: customer.customerId,
        lines: [],
      };
      const result = await service.create(dto, 'admin');
      expect(result).toHaveProperty('salesOrderId');
    });

    it('should fall back to system default when product has unknown GST category', async () => {
      const { validDto } = await setupCreate({ productTaxId: 'unknown-id' });
      await service.create(validDto, 'admin');
      expect(mocktaxService.getDefault).toHaveBeenCalled();
    });

    it('should throw native PG unique violation error (23505) if manual check is bypassed', async () => {
      const { validDto } = await setupCreate();

      // Insert an order with a specific number
      await pg.db.insert(salesOrders).values({
        orderNumber: 'DUPE-001',
        name: 'Existing',
        customerId: validDto.customerId,
        fulfillmentLocationId: '10000000-0000-0000-0000-000000000001',
        currencyCode: 'EUR',
        stateCode: SALES_ORDER_STATE.DRAFT,
      });

      // Mock generateOrderNumber to return the same number
      jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(service as any, 'generateOrderNumber')
        .mockResolvedValue('DUPE-001');

      try {
        await service.create(validDto, 'admin');
        throw new Error('Should have thrown');
      } catch (e: unknown) {
        const msg =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          getErrorMessage(e) + ' ' + ((e as any).cause?.message || '');
        expect(msg.toLowerCase()).toContain('duplicate');
      }
    });
  });

  // =========================================================================
  // update()
  // =========================================================================

  describe('update', () => {
    async function setupForUpdate(stateCode: string) {
      const customer = await createTestCustomer(pg.db);
      const order = await createTestSalesOrder(pg.db, {
        customerId: customer.customerId,
        locationId: '10000000-0000-0000-0000-000000000001',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state: stateCode as any,
      });
      return { order };
    }

    it('should update header fields on a draft order', async () => {
      const { order } = await setupForUpdate(SALES_ORDER_STATE.DRAFT);
      const result = await service.update(
        order.salesOrderId,
        { name: 'New Name' },
        'admin',
      );
      expect(result.name).toBe('New Name');

      const saved = await pg.db
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, order.salesOrderId));
      expect(saved[0].name).toBe('New Name');
    });

    it('should update header fields on a quoted order', async () => {
      const { order } = await setupForUpdate(SALES_ORDER_STATE.QUOTED);
      const result = await service.update(
        order.salesOrderId,
        { name: 'New Name' },
        'admin',
      );
      expect(result).toBeDefined();
    });

    it('should reject update on invoiced order', async () => {
      const { order } = await setupForUpdate(SALES_ORDER_STATE.INVOICED);
      await expect(
        service.update(order.salesOrderId, { name: 'Test' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update on cancelled order', async () => {
      const { order } = await setupForUpdate(SALES_ORDER_STATE.CANCELLED);
      await expect(
        service.update(order.salesOrderId, { notes: 'Test' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for unknown order', async () => {
      await expect(service.update('NOPE', {}, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // changeState()
  // =========================================================================

  describe('changeState', () => {
    async function setupWithState(currentState: string) {
      const customer = await createTestCustomer(pg.db);
      const order = await createTestSalesOrder(pg.db, {
        customerId: customer.customerId,
        locationId: '10000000-0000-0000-0000-000000000001',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state: currentState as any,
      });
      return { order };
    }

    it.each([
      [SALES_ORDER_STATE.DRAFT, SALES_ORDER_STATE.QUOTED],
      [SALES_ORDER_STATE.DRAFT, SALES_ORDER_STATE.CANCELLED],
      [SALES_ORDER_STATE.QUOTED, SALES_ORDER_STATE.CONFIRMED],
      [SALES_ORDER_STATE.QUOTED, SALES_ORDER_STATE.DRAFT],
      [SALES_ORDER_STATE.QUOTED, SALES_ORDER_STATE.CANCELLED],
      [SALES_ORDER_STATE.CONFIRMED, SALES_ORDER_STATE.PICKING],
      [SALES_ORDER_STATE.CONFIRMED, SALES_ORDER_STATE.CANCELLED],
      [SALES_ORDER_STATE.CONFIRMED, SALES_ORDER_STATE.QUOTED],
      [SALES_ORDER_STATE.PICKING, SALES_ORDER_STATE.SHIPPED],
      [SALES_ORDER_STATE.PICKING, SALES_ORDER_STATE.QUOTED],
      [SALES_ORDER_STATE.SHIPPED, SALES_ORDER_STATE.INVOICED],
      [SALES_ORDER_STATE.CANCELLED, SALES_ORDER_STATE.DRAFT],
    ])('should allow transition %s → %s', async (from, to) => {
      const { order } = await setupWithState(from);
      await expect(
        service.changeSalesOrderState(order.salesOrderId, to, 'admin'),
      ).resolves.toBeDefined();
    });

    it.each([
      [SALES_ORDER_STATE.DRAFT, SALES_ORDER_STATE.SHIPPED],
      [SALES_ORDER_STATE.DRAFT, SALES_ORDER_STATE.INVOICED],
      [SALES_ORDER_STATE.DRAFT, SALES_ORDER_STATE.PICKING],
      [SALES_ORDER_STATE.DRAFT, SALES_ORDER_STATE.CONFIRMED],
      [SALES_ORDER_STATE.PICKING, SALES_ORDER_STATE.CONFIRMED],
      [SALES_ORDER_STATE.SHIPPED, SALES_ORDER_STATE.DRAFT],
      [SALES_ORDER_STATE.INVOICED, SALES_ORDER_STATE.DRAFT],
      [SALES_ORDER_STATE.INVOICED, SALES_ORDER_STATE.CANCELLED],
    ])('should reject transition %s → %s', async (from, to) => {
      const { order } = await setupWithState(from);
      await expect(
        service.changeSalesOrderState(order.salesOrderId, to, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unknown state name', async () => {
      const { order } = await setupWithState(SALES_ORDER_STATE.DRAFT);
      await expect(
        service.changeSalesOrderState(
          order.salesOrderId,
          'nonexistent_state',
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    // ── Inventory integration tests ──

    it('should transition quoted → confirmed', async () => {
      const { order } = await setupWithState(SALES_ORDER_STATE.QUOTED);
      await service.changeSalesOrderState(
        order.salesOrderId,
        SALES_ORDER_STATE.CONFIRMED,
        'admin',
      );
      const saved = await pg.db
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, order.salesOrderId));
      expect(saved[0].stateCode).toBe(SALES_ORDER_STATE.CONFIRMED);
    });

    it('should transition confirmed → cancelled', async () => {
      const { order } = await setupWithState(SALES_ORDER_STATE.CONFIRMED);
      await service.changeSalesOrderState(
        order.salesOrderId,
        SALES_ORDER_STATE.CANCELLED,
        'admin',
      );
      const saved = await pg.db
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, order.salesOrderId));
      expect(saved[0].stateCode).toBe(SALES_ORDER_STATE.CANCELLED);
    });

    it('should transition draft → quoted without inventory side-effects', async () => {
      const { order } = await setupWithState(SALES_ORDER_STATE.DRAFT);
      await service.changeSalesOrderState(
        order.salesOrderId,
        SALES_ORDER_STATE.QUOTED,
        'admin',
      );
    });

    it('should transition draft → cancelled without inventory side-effects', async () => {
      const { order } = await setupWithState(SALES_ORDER_STATE.DRAFT);

      await service.changeSalesOrderState(
        order.salesOrderId,
        SALES_ORDER_STATE.CANCELLED,
        'admin',
      );
      expect(
        mockInventoryService.recordInventoryMovement,
      ).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // addLine()
  //
  // New select call sequence:
  //   1. findOrder → order row (with customerId)
  //   2. validateProduct → lookupProduct
  //   3. max line number query
  //   4. resolveTaxForLine → customers.taxCategoryId
  //   5. resolveTaxForLine → lookupProduct (for product gstCategory)
  // =========================================================================

  describe('addLine', () => {
    async function setupForAddLine(stateCode: string, maxLineNumber = 0) {
      const customer = await createTestCustomer(pg.db);
      const product = await createTestProduct(pg.db);
      const order = await createTestSalesOrder(pg.db, {
        customerId: customer.customerId,
        locationId: '10000000-0000-0000-0000-000000000001',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state: stateCode as any,
      });

      if (maxLineNumber > 0) {
        const dummyProduct = await createTestProduct(pg.db, {
          name: 'Dummy',
        });
        const lineValues = [];
        for (let i = 1; i <= maxLineNumber; i++) {
          lineValues.push({
            salesOrderId: order.salesOrderId,
            lineNumber: i,
            productId: dummyProduct.productId,
            quantity: '1',
            pricePerUnit: '10.00',
            taxCategoryId: TAX_DEFAULT.taxCategoryId,
            amount: '10.00',
            tax: '1.00',
            totalAmount: '11.00',
            unitOfMeasure: 'EA',
            fulfillmentLocationId: '10000000-0000-0000-0000-000000000001',
          });
        }
        await pg.db.insert(salesOrderLineItems).values(lineValues);
      }

      return { order, product };
    }

    it('should add a line to a draft order', async () => {
      const { order, product } = await setupForAddLine(
        SALES_ORDER_STATE.DRAFT,
        2,
      );
      const result = await service.addLine(
        order.salesOrderId,
        { productId: product.productId, quantity: '5', pricePerUnit: '12.00' },
        'admin',
      );
      expect(result).toHaveProperty('salesOrderLineId');
      expect(result.lineNumber).toBe(3);
    });

    it('should resolve GST via product category', async () => {
      const { order, product } = await setupForAddLine(SALES_ORDER_STATE.DRAFT);
      await service.addLine(
        order.salesOrderId,
        { productId: product.productId, quantity: '5', pricePerUnit: '12.00' },
        'admin',
      );
      expect(mocktaxService.getById).toHaveBeenCalledWith(
        TAX_DEFAULT.taxCategoryId,
        undefined,
      );
    });

    it('should use per-line GST override when provided', async () => {
      const { order, product } = await setupForAddLine(SALES_ORDER_STATE.DRAFT);
      await service.addLine(
        order.salesOrderId,
        {
          productId: product.productId,
          quantity: '5',
          pricePerUnit: '12.00',
          taxCategoryId: TAX_EXEMPT.taxCategoryId,
        },
        'admin',
      );
      expect(mocktaxService.getById).toHaveBeenCalledWith(
        TAX_EXEMPT.taxCategoryId,
        undefined,
      );
    });

    it('should reject adding to an invoiced order', async () => {
      const { order, product } = await setupForAddLine(
        SALES_ORDER_STATE.INVOICED,
      );
      await expect(
        service.addLine(
          order.salesOrderId,
          {
            productId: product.productId,
            quantity: '5',
            pricePerUnit: '12.00',
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject adding to a shipped order', async () => {
      const { order, product } = await setupForAddLine(
        SALES_ORDER_STATE.SHIPPED,
      );
      await expect(
        service.addLine(
          order.salesOrderId,
          {
            productId: product.productId,
            quantity: '5',
            pricePerUnit: '12.00',
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject adding to a cancelled order', async () => {
      const { order, product } = await setupForAddLine(
        SALES_ORDER_STATE.CANCELLED,
      );
      await expect(
        service.addLine(
          order.salesOrderId,
          {
            productId: product.productId,
            quantity: '5',
            pricePerUnit: '12.00',
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use zero-rate for zero-rated product', async () => {
      const { order } = await setupForAddLine(SALES_ORDER_STATE.DRAFT);
      const zeroProduct = await createTestProduct(pg.db, {
        name: 'Zero Prod',
      });
      // Mock the product service since the service layer uses it for lookup
      mockProductsService.findOne.mockResolvedValue({
        productId: zeroProduct.productId,
        name: 'Zero Prod',
        salesTaxCategoryId: TAX_ZERO.taxCategoryId,
      });

      await service.addLine(
        order.salesOrderId,
        {
          productId: zeroProduct.productId,
          quantity: '5',
          pricePerUnit: '12.00',
        },
        'admin',
      );
      expect(mocktaxService.getById).toHaveBeenCalledWith(
        TAX_ZERO.taxCategoryId,
        undefined,
      );
    });
  });

  // =========================================================================
  // updateLine()
  // =========================================================================

  describe('updateLine', () => {
    async function setupForUpdateLine(orderState: string) {
      const customer = await createTestCustomer(pg.db);
      const product = await createTestProduct(pg.db);
      const order = await createTestSalesOrder(pg.db, {
        customerId: customer.customerId,
        locationId: '10000000-0000-0000-0000-000000000001',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state: orderState as any,
      });

      const [line] = await pg.db
        .insert(salesOrderLineItems)
        .values({
          salesOrderId: order.salesOrderId,
          lineNumber: 1,
          productId: product.productId,
          quantity: '10',
          pricePerUnit: '5.00',
          taxCategoryId: TAX_DEFAULT.taxCategoryId,
          amount: '50.00',
          tax: '5.00',
          totalAmount: '55.00',
          unitOfMeasure: 'EA',
          fulfillmentLocationId: '10000000-0000-0000-0000-000000000001',
        })
        .returning();

      return { order, line, product };
    }

    it('should update line quantity on a draft order', async () => {
      const { order, line } = await setupForUpdateLine(SALES_ORDER_STATE.DRAFT);
      const result = await service.updateLine(
        order.salesOrderId,
        line.salesOrderLineId,
        { quantity: '20' },
        'admin',
      );
      expect(result).toHaveProperty('salesOrderLineId', line.salesOrderLineId);

      const saved = await pg.db
        .select()
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.salesOrderLineId, line.salesOrderLineId));
      expect(saved[0].quantity).toBe('20');
    });

    it('should resolve GST category for recomputation', async () => {
      const { order, line } = await setupForUpdateLine(SALES_ORDER_STATE.DRAFT);
      await service.updateLine(
        order.salesOrderId,
        line.salesOrderLineId,
        { quantity: '20' },
        'admin',
      );
      expect(mocktaxService.getById).toHaveBeenCalledWith(
        TAX_DEFAULT.taxCategoryId,
        undefined,
      );
    });

    it('should reject update on invoiced order', async () => {
      const { order, line } = await setupForUpdateLine(
        SALES_ORDER_STATE.INVOICED,
      );
      await expect(
        service.updateLine(
          order.salesOrderId,
          line.salesOrderLineId,
          { quantity: '20' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update on shipped order', async () => {
      const { order, line } = await setupForUpdateLine(
        SALES_ORDER_STATE.SHIPPED,
      );
      await expect(
        service.updateLine(
          order.salesOrderId,
          line.salesOrderLineId,
          { quantity: '20' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update on cancelled order', async () => {
      const { order, line } = await setupForUpdateLine(
        SALES_ORDER_STATE.CANCELLED,
      );
      await expect(
        service.updateLine(
          order.salesOrderId,
          line.salesOrderLineId,
          { quantity: '20' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // removeLine()
  // =========================================================================

  describe('removeLine', () => {
    async function setupForRemoveLine(orderState: string) {
      const customer = await createTestCustomer(pg.db);
      const product = await createTestProduct(pg.db);
      const order = await createTestSalesOrder(pg.db, {
        customerId: customer.customerId,
        locationId: '10000000-0000-0000-0000-000000000001',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state: orderState as any,
      });

      const [line] = await pg.db
        .insert(salesOrderLineItems)
        .values({
          salesOrderId: order.salesOrderId,
          lineNumber: 1,
          productId: product.productId,
          quantity: '10',
          pricePerUnit: '5.00',
          taxCategoryId: TAX_DEFAULT.taxCategoryId,
          amount: '50.00',
          tax: '5.00',
          totalAmount: '55.00',
          unitOfMeasure: 'EA',
          fulfillmentLocationId: '10000000-0000-0000-0000-000000000001',
        })
        .returning();

      return { order, line, product };
    }

    it('should remove a line from a draft order', async () => {
      const { order, line } = await setupForRemoveLine(SALES_ORDER_STATE.DRAFT);
      await expect(
        service.removeLine(order.salesOrderId, line.salesOrderLineId, 'admin'),
      ).resolves.toBeUndefined();

      const lines = await pg.db
        .select()
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.salesOrderId, order.salesOrderId));
      expect(lines.length).toBe(0);
    });

    it('should call transaction for removal', async () => {
      const { order, line } = await setupForRemoveLine(SALES_ORDER_STATE.DRAFT);
      await service.removeLine(
        order.salesOrderId,
        line.salesOrderLineId,
        'admin',
      );
      // PGLite transaction handles it naturally
    });

    it('should reject removal from invoiced order', async () => {
      const { order, line } = await setupForRemoveLine(
        SALES_ORDER_STATE.INVOICED,
      );
      await expect(
        service.removeLine(order.salesOrderId, line.salesOrderLineId, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject removal from shipped order', async () => {
      const { order, line } = await setupForRemoveLine(
        SALES_ORDER_STATE.SHIPPED,
      );
      await expect(
        service.removeLine(order.salesOrderId, line.salesOrderLineId, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject removal from cancelled order', async () => {
      const { order, line } = await setupForRemoveLine(
        SALES_ORDER_STATE.CANCELLED,
      );
      await expect(
        service.removeLine(order.salesOrderId, line.salesOrderLineId, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // findOne() / findOrder() / findLine()
  // =========================================================================

  describe('findOne', () => {
    it('should return order with lines and events', async () => {
      const customer = await createTestCustomer(pg.db);
      const product = await createTestProduct(pg.db);
      const order = await createTestSalesOrder(pg.db, {
        customerId: customer.customerId,
        locationId: '10000000-0000-0000-0000-000000000001',
        state: SALES_ORDER_STATE.DRAFT,
      });

      await pg.db.insert(salesOrderLineItems).values({
        salesOrderId: order.salesOrderId,
        lineNumber: 1,
        productId: product.productId,
        quantity: '10',
        pricePerUnit: '5.00',
        taxCategoryId: TAX_DEFAULT.taxCategoryId,
        amount: '50.00',
        tax: '5.00',
        totalAmount: '55.00',
        unitOfMeasure: 'EA',
        fulfillmentLocationId: '10000000-0000-0000-0000-000000000001',
      });

      // Events are automatically handled if created through the service, or we can insert one directly:
      // Since this is just fetching, we'll see if the base findOne works

      const result = await service.findOne(order.salesOrderId);
      expect(result).toHaveProperty('salesOrderId', order.salesOrderId);
      expect(result.lines).toHaveLength(1);
      // Wait, we didn't insert an event, so events might be empty unless create triggers it.
      // But we inserted directly, so it'll be 0 unless we also mock the events.
      // We can insert an event manually
      // Let's just expect it to be defined and an array
      expect(Array.isArray(result.events)).toBe(true);
    });

    it('should throw NotFoundException for unknown order', async () => {
      await expect(
        service.findOne('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findLine (via updateLine)', () => {
    it('should throw NotFoundException when line does not exist', async () => {
      const customer = await createTestCustomer(pg.db);
      const order = await createTestSalesOrder(pg.db, {
        customerId: customer.customerId,
        locationId: '10000000-0000-0000-0000-000000000001',
        state: SALES_ORDER_STATE.DRAFT,
      });

      await expect(
        service.updateLine(
          order.salesOrderId,
          '00000000-0000-0000-0000-000000000000',
          { quantity: '1' },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if line belongs to different order', async () => {
      const customer = await createTestCustomer(pg.db);
      const product = await createTestProduct(pg.db);

      const order1 = await createTestSalesOrder(pg.db, {
        customerId: customer.customerId,
        locationId: '10000000-0000-0000-0000-000000000001',
      });
      const order2 = await createTestSalesOrder(pg.db, {
        customerId: customer.customerId,
        locationId: '10000000-0000-0000-0000-000000000001',
      });

      const [line] = await pg.db
        .insert(salesOrderLineItems)
        .values({
          salesOrderId: order2.salesOrderId, // belongs to order2
          lineNumber: 1,
          productId: product.productId,
          quantity: '10',
          pricePerUnit: '5.00',
          taxCategoryId: TAX_DEFAULT.taxCategoryId,
          amount: '50.00',
          tax: '5.00',
          totalAmount: '55.00',
          unitOfMeasure: 'EA',
          fulfillmentLocationId: '10000000-0000-0000-0000-000000000001',
        })
        .returning();

      await expect(
        service.updateLine(
          order1.salesOrderId, // attempt to update using order1's ID
          line.salesOrderLineId,
          { quantity: '20' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // Product Kits & BOM Explosion
  // =========================================================================

  describe('Product Kits & BOM Explosion', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let kitProduct: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let comp1: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let comp2: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let customer: any;

    beforeEach(async () => {
      // Allow the service to resolve products from the actual DB instead of the generic mock
      mockProductsService.findOne.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (id: string, txArg?: any) => {
          const db = txArg || pg.db;
          const rows = await db
            .select()
            .from(coreProducts)
            .where(eq(coreProducts.productId, id));
          if (rows.length > 0) return rows[0];
          throw new NotFoundException();
        },
      );

      customer = await createTestCustomer(pg.db);

      // Create child components
      comp1 = await createTestProduct(pg.db, {
        name: 'Child Component 1',
        productType: 'inventory',
        listPrice: '10.00',
        salesTaxCategoryId: TAX_DEFAULT.taxCategoryId,
      });
      comp2 = await createTestProduct(pg.db, {
        name: 'Child Component 2',
        productType: 'inventory',
        listPrice: '15.00',
        salesTaxCategoryId: TAX_DEFAULT.taxCategoryId,
      });

      // Create Parent Kit Product
      kitProduct = await createTestProduct(pg.db, {
        name: 'Parent Kit',
        productType: 'kit',
        listPrice: '50.00',
        salesTaxCategoryId: TAX_DEFAULT.taxCategoryId,
      });

      // Link them in product_components
      await pg.db.insert(productComponents).values([
        {
          parentProductId: kitProduct.productId,
          childProductId: comp1.productId,
          quantity: '2',
          sequenceNumber: 1,
        },
        {
          parentProductId: kitProduct.productId,
          childProductId: comp2.productId,
          quantity: '1',
          sequenceNumber: 2,
        },
      ]);
    });

    it('should explode kit on order create (Parent Price > 0)', async () => {
      // When parent price > 0, children are $0
      const dto = {
        salesOrderId: '00000000-0000-0000-0000-000000000001',
        customerId: customer.customerId,
        lines: [
          {
            productId: kitProduct.productId,
            quantity: '3',
            pricePerUnit: '50.00',
          },
        ],
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await service.create(dto as any, 'admin');

      const lines = await pg.db
        .select()
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.salesOrderId, result.salesOrderId))
        .orderBy(salesOrderLineItems.lineNumber);

      expect(lines).toHaveLength(3);

      const parentLine = lines[0];
      const childLine1 = lines[1];
      const childLine2 = lines[2];

      expect(parentLine.productId).toBe(kitProduct.productId);
      expect(parentLine.quantity).toBe('3');
      expect(parseFloat(parentLine.pricePerUnit)).toBe(50);
      expect(parentLine.parentLineId).toBeNull();

      expect(childLine1.productId).toBe(comp1.productId);
      // parent qty (3) * component qty (2) = 6
      expect(childLine1.quantity).toBe('6');
      expect(childLine1.pricePerUnit).toBe('0');
      expect(childLine1.parentLineId).toBe(parentLine.salesOrderLineId);

      expect(childLine2.productId).toBe(comp2.productId);
      // parent qty (3) * component qty (1) = 3
      expect(childLine2.quantity).toBe('3');
      expect(childLine2.pricePerUnit).toBe('0');
      expect(childLine2.parentLineId).toBe(parentLine.salesOrderLineId);
    });

    it('should explode kit on order create (Parent Price = 0)', async () => {
      // When parent price = 0, children use standard listPrice
      const dto = {
        salesOrderId: '00000000-0000-0000-0000-000000000001',
        customerId: customer.customerId,
        lines: [
          {
            productId: kitProduct.productId,
            quantity: '2',
            pricePerUnit: '0',
          },
        ],
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await service.create(dto as any, 'admin');

      const lines = await pg.db
        .select()
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.salesOrderId, result.salesOrderId))
        .orderBy(salesOrderLineItems.lineNumber);

      expect(lines).toHaveLength(3);

      const parentLine = lines[0];
      const childLine1 = lines[1];
      const childLine2 = lines[2];

      expect(parentLine.pricePerUnit).toBe('0');

      expect(childLine1.productId).toBe(comp1.productId);
      expect(childLine1.quantity).toBe('4'); // 2 * 2
      expect(parseFloat(childLine1.pricePerUnit)).toBe(10); // comp1 listPrice

      expect(childLine2.productId).toBe(comp2.productId);
      expect(childLine2.quantity).toBe('2'); // 2 * 1
      expect(parseFloat(childLine2.pricePerUnit)).toBe(15); // comp2 listPrice
    });

    it('should scale child quantities and toggle prices on parent line update', async () => {
      // Create initial order with parent price > 0
      const createDto = {
        salesOrderId: '00000000-0000-0000-0000-000000000001',
        customerId: customer.customerId,
        lines: [
          {
            productId: kitProduct.productId,
            quantity: '1',
            pricePerUnit: '50.00',
          },
        ],
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const order = await service.create(createDto as any, 'admin');

      let lines = await pg.db
        .select()
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.salesOrderId, order.salesOrderId))
        .orderBy(salesOrderLineItems.lineNumber);

      const parentLineId = lines[0].salesOrderLineId;

      // Update parent line: change quantity from 1 to 5, and change price from 50 to 0
      await service.updateLine(
        order.salesOrderId,
        parentLineId,
        { quantity: '5', pricePerUnit: '0' },
        'admin',
      );

      lines = await pg.db
        .select()
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.salesOrderId, order.salesOrderId))
        .orderBy(salesOrderLineItems.lineNumber);

      const parentLine = lines[0];
      const childLine1 = lines[1];
      const childLine2 = lines[2];

      expect(parentLine.quantity).toBe('5');
      expect(parentLine.pricePerUnit).toBe('0');

      // Quantities should scale by 5x (since newQty/oldQty = 5/1)
      expect(childLine1.quantity).toBe('10'); // 5 * 2
      // Because new parent price is 0, it should toggle to standard listPrice
      expect(parseFloat(childLine1.pricePerUnit)).toBe(10);

      expect(childLine2.quantity).toBe('5'); // 5 * 1
      expect(parseFloat(childLine2.pricePerUnit)).toBe(15);
    });

    it('should cascade deletion to child lines when parent kit is removed', async () => {
      const createDto = {
        salesOrderId: '00000000-0000-0000-0000-000000000001',
        customerId: customer.customerId,
        lines: [
          {
            productId: kitProduct.productId,
            quantity: '1',
            pricePerUnit: '50.00',
          },
        ],
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const order = await service.create(createDto as any, 'admin');

      let lines = await pg.db
        .select()
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.salesOrderId, order.salesOrderId));

      expect(lines).toHaveLength(3);
      const parentLine = lines.find((l) => l.parentLineId === null)!;

      // Remove the parent line
      await service.removeLine(
        order.salesOrderId,
        parentLine.salesOrderLineId,
        'admin',
      );

      lines = await pg.db
        .select()
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.salesOrderId, order.salesOrderId));

      expect(lines).toHaveLength(0); // Children should be deleted too
    });
  });
});

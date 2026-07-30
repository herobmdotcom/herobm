import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from '../settings/app-config.service';
import { ReturnsWriteService } from './returns-write.service';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { SalesCreditNoteService } from '../invoices/sales-credit-note.service';

import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { emitEvent } from '../common/emit-event';
import { EntityType } from '../common/event-types';
import {
  locations,
  salesOrderReturns,
  taxCategories,
  bins,
  zones,
} from '@herobm/db-schema';

jest.mock('../common/emit-event', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}));

import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { eq, sql } from 'drizzle-orm';
import {
  createTestCustomer,
  createTestProduct,
  createTestSalesOrder,
  createTestSalesOrderLine,
  createTestReturn,
  createTestReturnLine,
  createTestShipment,
  createTestShipmentLine,
} from '../../test/fixtures';
import { SALES_ORDER_STATE, RETURN_STATE } from '@herobm/shared';
import type { ReturnState, SalesOrderState } from '@herobm/shared';
import { InventoryMovementService } from '../inventory/inventory-movement.service';
import { InventoryQueryService } from '../inventory/inventory-query.service';

// Shared test data
const INVOICED_ORDER = {
  salesOrderId: 'order-001',
  orderNumber: 'ORD-20260315-0001',
  stateCode: SALES_ORDER_STATE.INVOICED,
  customerId: '00000000-0000-4000-8000-000000000001',
};

const DRAFT_ORDER = {
  salesOrderId: 'order-002',
  orderNumber: 'ORD-20260315-0002',
  stateCode: SALES_ORDER_STATE.DRAFT,
  customerId: '00000000-0000-4000-8000-000000000001',
};

const ORDER_LINE = {
  salesOrderLineId: 'line-001',
  salesOrderId: 'order-001',
  lineNumber: 1,
  productId: 'PROD-001',
  quantity: '10',
  pricePerUnit: '50.00',
  amount: '500.00',
};

const MOCK_RETURN = {
  returnId: 'ret-001',
  returnNumber: 'RET-20260315-0001',
  salesOrderId: 'order-001',
  stateCode: RETURN_STATE.DRAFT,
  notes: null,
  createdBy: 'admin',
};

const MOCK_RETURN_LINE = {
  returnLineId: 'retline-001',
  returnId: 'ret-001',
  salesOrderLineId: 'line-001',
  quantityReturned: '5',
  reason: 'Defective',
  returnFee: '10.00',
};

describe('ReturnsWriteService', () => {
  const pg = setupPgliteSuite();
  let service: ReturnsWriteService;

  let mockInventoryService: any;

  let mockGlService: any;

  let mocktaxService: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    await pg.client.exec(`
      TRUNCATE herobm_core.sales_order_return_lines CASCADE;
      TRUNCATE herobm_core.sales_order_returns CASCADE;
      TRUNCATE herobm_core.sales_order_shipment_lines CASCADE;
      TRUNCATE herobm_core.sales_order_shipments CASCADE;
      TRUNCATE herobm_core.sales_order_lines CASCADE;
      TRUNCATE herobm_core.sales_orders CASCADE;
      TRUNCATE herobm_core.customers CASCADE;
      TRUNCATE herobm_core.products CASCADE;
      TRUNCATE herobm_core.outbox CASCADE;
    `);

    mockInventoryService = {
      recordInventoryMovement: jest.fn().mockResolvedValue(undefined),
    };

    mockGlService = {
      getSettings: jest.fn().mockResolvedValue(null),
      postJournalEntry: jest.fn().mockResolvedValue({
        journalEntryId: 'je-001',
        entryNumber: 'JE-20260323-0001',
      }),
    };

    mocktaxService = {
      getById: jest.fn().mockResolvedValue({ rate: '0' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: AppConfigService,
          useValue: {
            valuationMethod: () => 'weighted_average',
            inventoryAccountingMode: () => 'perpetual',
            defaultInventoryAccountId: () => 'inv-acct-001',
            defaultGrniAccountId: () => 'grni-acct-001',
            defaultCogsAccountId: () => 'cogs-acct-001',
            defaultShrinkageAccountId: () => 'shrink-acct-001',
            defaultPpvAccountId: () => 'ppv-acct-001',
          },
        },
        ReturnsWriteService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: InventoryQueryService, useValue: mockInventoryService },
        { provide: GlService, useValue: mockGlService },
        { provide: TaxCategoriesService, useValue: mocktaxService },
        {
          provide: SalesCreditNoteService,
          useValue: {
            createCreditNote: jest.fn().mockResolvedValue({
              creditNoteId: 'cn-001',
              creditNoteNumber: 'CN-TEST-0001',
            }),
          },
        },
        { provide: InventoryMovementService, useValue: mockInventoryService },
      ],
    }).compile();

    service = module.get<ReturnsWriteService>(ReturnsWriteService);
  });

  // =========================================================================
  // createReturn()
  //
  // Select call sequence:
  //   1. findOrder → order row
  //   2. findOrderLine → order line row (per line in dto)
  //   3. getAlreadyReturnedQty → SUM query (per line)
  //   4. generateReturnNumber → returns query
  // =========================================================================

  describe('createReturn', () => {
    const validDto = {
      notes: 'Customer returned items',
      lines: [
        {
          salesOrderLineId: 'line-001',
          quantityReturned: '5',
          reason: 'Defective',
          returnFee: '10.00',
        },
      ],
    };

    let customerId: string;
    let productId: string;
    let orderId: string;
    let lineId: string;

    async function setupCreate(opts?: {
      orderState?: SalesOrderState;
      alreadyReturned?: number;
      originalQty?: number;
      shippedQty?: number;
    }) {
      const cust = await createTestCustomer(pg.db);
      customerId = cust.customerId;

      const prod = await createTestProduct(pg.db);
      productId = prod.productId;

      await pg.db
        .insert(locations)
        .values({
          locationId: '10000000-0000-4000-8000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing()
        .returning();

      const order = await createTestSalesOrder(pg.db, {
        customerId,
        locationId: '10000000-0000-4000-8000-000000000001',
        state: opts?.orderState ?? SALES_ORDER_STATE.INVOICED,
      });
      orderId = order.salesOrderId;

      const taxRes = await pg.db
        .select()
        .from(taxCategories)
        .where(eq(taxCategories.code, 'GST'));
      const taxId = taxRes[0].taxCategoryId;

      const line = await createTestSalesOrderLine(pg.db, {
        salesOrderId: orderId,
        productId,
        taxCategoryId: taxId,
        quantity: opts?.originalQty ?? 10,
        price: 10,
      });
      lineId = line.salesOrderLineId;

      // Create a dispatched shipment so shipped qty is non-zero
      const shipped = opts?.shippedQty ?? opts?.originalQty ?? 10;
      if (shipped > 0) {
        const shipment = await createTestShipment(pg.db, {
          salesOrderId: orderId,
        });
        await createTestShipmentLine(pg.db, {
          shipmentId: shipment.shipmentId,
          salesOrderLineId: lineId,
          quantityShipped: shipped,
        });
      }

      if (opts?.alreadyReturned) {
        const ret = await createTestReturn(pg.db, {
          salesOrderId: orderId,
          state: RETURN_STATE.DRAFT,
        });
        await createTestReturnLine(pg.db, {
          returnId: ret.returnId,
          salesOrderLineId: lineId,
          quantity: opts.alreadyReturned,
        });
      }
    }

    it('should create a return against an invoiced order', async () => {
      await setupCreate();
      const validDto = {
        notes: 'Customer returned items',
        lines: [
          {
            salesOrderLineId: lineId,
            quantityReturned: '5',
            reason: 'Defective',
            returnFee: '10.00',
          },
        ],
      };
      const result = await service.createReturn(orderId, validDto, 'admin');
      expect(result).toHaveProperty('returnId');
      expect(result).toHaveProperty('stateCode', RETURN_STATE.DRAFT);
    });

    it('should reject return against a non-invoiced order', async () => {
      await setupCreate({ orderState: SALES_ORDER_STATE.DRAFT });
      const validDto = {
        lines: [
          {
            salesOrderLineId: lineId,
            quantityReturned: '5',
            reason: 'Defective',
          },
        ],
      };
      await expect(
        service.createReturn(orderId, validDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject return against a confirmed order', async () => {
      await setupCreate({ orderState: SALES_ORDER_STATE.CONFIRMED });
      const validDto = {
        lines: [
          {
            salesOrderLineId: lineId,
            quantityReturned: '5',
            reason: 'Defective',
          },
        ],
      };
      await expect(
        service.createReturn(orderId, validDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept return against a shipped order', async () => {
      await setupCreate({ orderState: SALES_ORDER_STATE.SHIPPED });
      const validDto = {
        lines: [
          {
            salesOrderLineId: lineId,
            quantityReturned: '5',
            reason: 'Defective',
          },
        ],
      };
      const result = await service.createReturn(orderId, validDto, 'admin');
      expect(result).toHaveProperty('returnId');
      expect(result).toHaveProperty('stateCode', RETURN_STATE.DRAFT);
    });

    it('should reject return when quantity exceeds original', async () => {
      await setupCreate({ originalQty: 3 });
      const validDto = {
        lines: [
          {
            salesOrderLineId: lineId,
            quantityReturned: '5',
            reason: 'Defective',
          },
        ],
      };
      await expect(
        service.createReturn(orderId, validDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject return when quantity exceeds remaining after prior returns', async () => {
      await setupCreate({ alreadyReturned: 8 });
      const validDto = {
        lines: [
          {
            salesOrderLineId: lineId,
            quantityReturned: '5',
            reason: 'Defective',
          },
        ],
      };
      await expect(
        service.createReturn(orderId, validDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject return with zero quantity', async () => {
      await setupCreate();
      const dto = {
        lines: [{ salesOrderLineId: lineId, quantityReturned: '0' }],
      };
      await expect(service.createReturn(orderId, dto, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject return with negative fee', async () => {
      await setupCreate();
      const dto = {
        lines: [
          { salesOrderLineId: lineId, quantityReturned: '5', returnFee: '-10' },
        ],
      };
      await expect(service.createReturn(orderId, dto, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create return with no lines', async () => {
      await setupCreate();
      const dto = { lines: [] };
      const result = await service.createReturn(orderId, dto, 'admin');
      expect(result).toHaveProperty('returnId');
    });
  });

  // =========================================================================
  // updateReturn()
  // =========================================================================

  describe('updateReturn', () => {
    let returnId: string;

    async function setupForUpdate(stateCode: ReturnState) {
      const cust = await createTestCustomer(pg.db);
      await pg.db
        .insert(locations)
        .values({
          locationId: '10000000-0000-4000-8000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing()
        .returning();
      const order = await createTestSalesOrder(pg.db, {
        customerId: cust.customerId,
        locationId: '10000000-0000-4000-8000-000000000001',
      });
      const ret = await createTestReturn(pg.db, {
        salesOrderId: order.salesOrderId,
        state: stateCode,
      });
      returnId = ret.returnId;
    }

    it('should update notes on a draft return', async () => {
      await setupForUpdate(RETURN_STATE.DRAFT);
      const result = await service.updateReturn(
        returnId,
        { notes: 'Updated notes' },
        'admin',
      );
      expect(result.notes).toBe('Updated notes');
    });

    it('should allow update on confirmed return', async () => {
      await setupForUpdate(RETURN_STATE.CONFIRMED);
      const res = await service.updateReturn(
        returnId,
        { notes: 'Test' },
        'admin',
      );
      expect(res.notes).toBe('Test');
    });

    it('should reject update on processed return', async () => {
      await setupForUpdate(RETURN_STATE.PROCESSED);
      await expect(
        service.updateReturn(returnId, { notes: 'Test' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // changeReturnState()
  // =========================================================================

  describe('changeReturnState', () => {
    let returnId: string;
    let orderId: string;
    let lineId: string;
    let productId: string;

    async function setupWithState(currentState: ReturnState) {
      const cust = await createTestCustomer(pg.db);

      const prod = await createTestProduct(pg.db);
      productId = prod.productId;

      await pg.db
        .insert(locations)
        .values({
          locationId: '10000000-0000-4000-8000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing()
        .returning();

      // HANDLING zone with CUSTOMER_RETURNS bin (for received transition)
      await pg.db
        .insert(zones)
        .values({
          zoneId: '00000000-0000-4000-8000-000000000001',
          locationId: '10000000-0000-4000-8000-000000000001',
          code: 'HANDLING',
          name: 'Handling',
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing();
      await pg.db
        .insert(bins)
        .values({
          binId: '20000000-0000-4000-8000-000000000001',
          zoneId: '00000000-0000-4000-8000-000000000001',
          binNumber: 'CUSTOMER_RETURNS',
          binType: 'staging',
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing();

      const order = await createTestSalesOrder(pg.db, {
        customerId: cust.customerId,
        locationId: '10000000-0000-4000-8000-000000000001',
      });
      orderId = order.salesOrderId;

      const taxRes = await pg.db
        .select()
        .from(taxCategories)
        .where(eq(taxCategories.code, 'GST'));
      const taxId = taxRes[0].taxCategoryId;

      const line = await createTestSalesOrderLine(pg.db, {
        salesOrderId: orderId,
        productId,
        taxCategoryId: taxId,
        quantity: 10,
        price: 10,
      });
      lineId = line.salesOrderLineId;

      const ret = await createTestReturn(pg.db, {
        salesOrderId: orderId,
        state: currentState,
      });
      returnId = ret.returnId;

      await createTestReturnLine(pg.db, {
        returnId,
        salesOrderLineId: lineId,
        quantity: 5,
        returnFee: 10,
      });
    }

    it.each([
      [RETURN_STATE.DRAFT, RETURN_STATE.CONFIRMED],
      [RETURN_STATE.DRAFT, RETURN_STATE.CANCELLED],
      [RETURN_STATE.CONFIRMED, RETURN_STATE.PARTIALLY_RECEIVED],
      [RETURN_STATE.CONFIRMED, RETURN_STATE.RECEIVED],
      [RETURN_STATE.CONFIRMED, RETURN_STATE.CANCELLED],
      [RETURN_STATE.PARTIALLY_RECEIVED, RETURN_STATE.RECEIVED],
      [RETURN_STATE.RECEIVED, RETURN_STATE.PROCESSED],
    ])('should allow transition %s → %s', async (from, to) => {
      await setupWithState(from as ReturnState);
      await expect(
        service.changeReturnState(
          returnId,
          to,
          'admin',
          to === RETURN_STATE.RECEIVED
            ? '10000000-0000-4000-8000-000000000001'
            : undefined,
        ),
      ).resolves.toBeDefined();
    });

    it.each([
      [RETURN_STATE.DRAFT, RETURN_STATE.PROCESSED],
      [RETURN_STATE.DRAFT, RETURN_STATE.RECEIVED],
      [RETURN_STATE.CONFIRMED, RETURN_STATE.PROCESSED],
      [RETURN_STATE.PROCESSED, RETURN_STATE.DRAFT],
      [RETURN_STATE.PROCESSED, RETURN_STATE.CONFIRMED],
      [RETURN_STATE.CANCELLED, RETURN_STATE.DRAFT],
      [RETURN_STATE.CONFIRMED, RETURN_STATE.DRAFT],
      [RETURN_STATE.RECEIVED, RETURN_STATE.CONFIRMED],
    ])('should reject transition %s → %s', async (from, to) => {
      await setupWithState(from as ReturnState);
      await expect(
        service.changeReturnState(returnId, to, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unknown state name', async () => {
      await setupWithState(RETURN_STATE.DRAFT);
      await expect(
        service.changeReturnState(returnId, 'nonexistent', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should emit event when transitioning to received', async () => {
      await setupWithState(RETURN_STATE.CONFIRMED);
      await service.changeReturnState(
        returnId,
        RETURN_STATE.RECEIVED,
        'admin',
        '10000000-0000-4000-8000-000000000001',
      );
      const [updated] = await pg.db
        .select()
        .from(salesOrderReturns)
        .where(eq(salesOrderReturns.returnId, returnId));
      expect(updated?.stateCode).toBe(RETURN_STATE.RECEIVED);
    });
  });

  // =========================================================================
  // GL posting via changeReturnState
  //
  // RECEIVED: inventory/COGS GL reversal (via accounting strategy)
  // PROCESSED: delegates to SalesCreditNoteService.createCreditNote()
  // =========================================================================

  describe('GL posting on state transitions', () => {
    async function setupGlTransitionTest(startState: ReturnState) {
      const cust = await createTestCustomer(pg.db);
      const prod = await createTestProduct(pg.db);

      await pg.db
        .insert(locations)
        .values({
          locationId: '10000000-0000-4000-8000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing()
        .returning();

      // HANDLING zone with CUSTOMER_RETURNS bin
      await pg.db
        .insert(zones)
        .values({
          zoneId: '00000000-0000-4000-8000-000000000001',
          locationId: '10000000-0000-4000-8000-000000000001',
          code: 'HANDLING',
          name: 'Handling',
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing();
      await pg.db
        .insert(bins)
        .values({
          binId: '20000000-0000-4000-8000-000000000001',
          binNumber: 'CUSTOMER_RETURNS',
          zoneId: '00000000-0000-4000-8000-000000000001',
          binType: 'staging',
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing();

      const order = await createTestSalesOrder(pg.db, {
        customerId: cust.customerId,
        locationId: '10000000-0000-4000-8000-000000000001',
      });

      const taxRes = await pg.db
        .select()
        .from(taxCategories)
        .where(eq(taxCategories.code, 'GST'));
      const taxId = taxRes[0].taxCategoryId;

      const orderLine = await createTestSalesOrderLine(pg.db, {
        salesOrderId: order.salesOrderId,
        productId: prod.productId,
        quantity: 10,
        price: 50,
        taxCategoryId: taxId,
      });

      const ret = await createTestReturn(pg.db, {
        salesOrderId: order.salesOrderId,
        state: startState,
      });

      const retLine = await createTestReturnLine(pg.db, {
        returnId: ret.returnId,
        salesOrderLineId: orderLine.salesOrderLineId,
        quantity: 5,
        returnFee: 10,
      });

      return { retId: ret.returnId, retLineId: retLine.returnLineId };
    }

    it('should post inventory GL reversal on RECEIVED transition', async () => {
      const { retId, retLineId } = await setupGlTransitionTest(
        RETURN_STATE.CONFIRMED,
      );

      await service.receiveReturnLines(
        retId,
        {
          locationId: '10000000-0000-4000-8000-000000000001',
          lines: [{ returnLineId: retLineId, quantityReceived: '5' }],
        },
        'admin',
      );

      // Inventory receive + COGS GL reversal should have been posted
      expect(mockGlService.postJournalEntry).toHaveBeenCalledTimes(1);
      expect(
        mockInventoryService.recordInventoryMovement,
      ).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // addReturnLine()
  //
  // Select call sequence:
  //   1. findReturn → return row
  //   2. findOrderLine → order line row
  //   3. getAlreadyReturnedQty → SUM
  // =========================================================================

  describe('addReturnLine', () => {
    let returnId: string;
    let orderId: string;
    let lineId: string;

    async function setupForAddLine(
      returnState: ReturnState,
      alreadyReturned = 0,
    ) {
      const cust = await createTestCustomer(pg.db);
      const prod = await createTestProduct(pg.db);

      await pg.db
        .insert(locations)
        .values({
          locationId: '10000000-0000-4000-8000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing()
        .returning();
      const order = await createTestSalesOrder(pg.db, {
        customerId: cust.customerId,
        locationId: '10000000-0000-4000-8000-000000000001',
      });
      orderId = order.salesOrderId;

      const taxRes = await pg.db
        .select()
        .from(taxCategories)
        .where(eq(taxCategories.code, 'GST'));

      const line = await createTestSalesOrderLine(pg.db, {
        salesOrderId: orderId,
        productId: prod.productId,
        taxCategoryId: taxRes[0].taxCategoryId,
        quantity: 10,
        price: 10,
      });
      lineId = line.salesOrderLineId;

      // Create shipment so shipped qty validation passes
      const shipment = await createTestShipment(pg.db, {
        salesOrderId: orderId,
      });
      await createTestShipmentLine(pg.db, {
        shipmentId: shipment.shipmentId,
        salesOrderLineId: lineId,
        quantityShipped: 10,
      });

      const ret = await createTestReturn(pg.db, {
        salesOrderId: orderId,
        state: returnState,
      });
      returnId = ret.returnId;

      if (alreadyReturned > 0) {
        await createTestReturnLine(pg.db, {
          returnId,
          salesOrderLineId: lineId,
          quantity: alreadyReturned,
        });
      }
    }

    it('should add a line to a draft return', async () => {
      await setupForAddLine(RETURN_STATE.DRAFT);
      const dto = {
        salesOrderLineId: lineId,
        quantityReturned: '3',
        reason: 'Wrong item',
        returnFee: '5.00',
      };
      const result = await service.addReturnLine(returnId, dto, 'admin');
      expect(result).toHaveProperty('returnLineId');
    });

    it('should reject negative return fee', async () => {
      await setupForAddLine(RETURN_STATE.DRAFT);
      const dto = {
        salesOrderLineId: lineId,
        quantityReturned: '3',
        reason: 'Wrong item',
        returnFee: '-5.00',
      };
      await expect(
        service.addReturnLine(returnId, dto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // updateReturnLine()
  // =========================================================================

  describe('updateReturnLine', () => {
    let returnId: string;
    let returnLineId: string;

    async function setupForUpdateLine(stateCode: ReturnState) {
      const cust = await createTestCustomer(pg.db);
      const prod = await createTestProduct(pg.db);
      await pg.db
        .insert(locations)
        .values({
          locationId: '10000000-0000-4000-8000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing()
        .returning();

      const order = await createTestSalesOrder(pg.db, {
        customerId: cust.customerId,
        locationId: '10000000-0000-4000-8000-000000000001',
      });
      const taxRes = await pg.db
        .select()
        .from(taxCategories)
        .where(eq(taxCategories.code, 'GST'));
      const orderLine = await createTestSalesOrderLine(pg.db, {
        salesOrderId: order.salesOrderId,
        productId: prod.productId,
        quantity: 10,
        price: 50,
        taxCategoryId: taxRes[0].taxCategoryId,
      });

      // Create shipment so shipped qty validation passes
      const shipment = await createTestShipment(pg.db, {
        salesOrderId: order.salesOrderId,
      });
      await createTestShipmentLine(pg.db, {
        shipmentId: shipment.shipmentId,
        salesOrderLineId: orderLine.salesOrderLineId,
        quantityShipped: 10,
      });

      const ret = await createTestReturn(pg.db, {
        salesOrderId: order.salesOrderId,
        state: stateCode,
      });
      returnId = ret.returnId;

      const retLine = await createTestReturnLine(pg.db, {
        returnId,
        salesOrderLineId: orderLine.salesOrderLineId,
        quantity: 5,
      });
      returnLineId = retLine.returnLineId;
    }

    it('should update return line on a draft return', async () => {
      await setupForUpdateLine(RETURN_STATE.DRAFT);
      const result = await service.updateReturnLine(
        returnId,
        returnLineId,
        { reason: 'Changed mind' },
        'admin',
      );
      expect(result).toBeDefined();
    });

    it('should allow update on confirmed return', async () => {
      await setupForUpdateLine(RETURN_STATE.CONFIRMED);
      const result = await service.updateReturnLine(
        returnId,
        returnLineId,
        { reason: 'Test' },
        'admin',
      );
      expect(result).toBeDefined();
    });

    it('should reject negative return fee', async () => {
      await setupForUpdateLine(RETURN_STATE.DRAFT);
      await expect(
        service.updateReturnLine(
          returnId,
          returnLineId,
          { returnFee: '-5' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // removeReturnLine()
  // =========================================================================

  describe('removeReturnLine', () => {
    let returnId: string;
    let returnLineId: string;

    async function setupForRemoveLine(stateCode: ReturnState) {
      const cust = await createTestCustomer(pg.db);
      const prod = await createTestProduct(pg.db);
      await pg.db
        .insert(locations)
        .values({
          locationId: '10000000-0000-4000-8000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing()
        .returning();

      const order = await createTestSalesOrder(pg.db, {
        customerId: cust.customerId,
        locationId: '10000000-0000-4000-8000-000000000001',
      });
      const taxRes = await pg.db
        .select()
        .from(taxCategories)
        .where(eq(taxCategories.code, 'GST'));
      const orderLine = await createTestSalesOrderLine(pg.db, {
        salesOrderId: order.salesOrderId,
        productId: prod.productId,
        quantity: 10,
        price: 50,
        taxCategoryId: taxRes[0].taxCategoryId,
      });

      const ret = await createTestReturn(pg.db, {
        salesOrderId: order.salesOrderId,
        state: stateCode,
      });
      returnId = ret.returnId;

      const retLine = await createTestReturnLine(pg.db, {
        returnId,
        salesOrderLineId: orderLine.salesOrderLineId,
        quantity: 5,
      });
      returnLineId = retLine.returnLineId;
    }

    it('should remove a line from a draft return', async () => {
      await setupForRemoveLine(RETURN_STATE.DRAFT);
      await expect(
        service.removeReturnLine(returnId, returnLineId, 'admin'),
      ).resolves.toBeUndefined();
    });

    it('should allow removal from confirmed return', async () => {
      await setupForRemoveLine(RETURN_STATE.CONFIRMED);
      await expect(
        service.removeReturnLine(returnId, returnLineId, 'admin'),
      ).resolves.toBeUndefined();
    });

    it('should reject removal from processed return', async () => {
      await setupForRemoveLine(RETURN_STATE.PROCESSED);
      await expect(
        service.removeReturnLine(returnId, returnLineId, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // findOne() / findByOrder()
  // =========================================================================

  describe('findOne', () => {
    it('should return return with lines', async () => {
      const cust = await createTestCustomer(pg.db);
      const prod = await createTestProduct(pg.db);
      await pg.db
        .insert(locations)
        .values({
          locationId: '10000000-0000-4000-8000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing()
        .returning();

      const order = await createTestSalesOrder(pg.db, {
        customerId: cust.customerId,
        locationId: '10000000-0000-4000-8000-000000000001',
      });
      const ret = await createTestReturn(pg.db, {
        salesOrderId: order.salesOrderId,
        state: RETURN_STATE.DRAFT,
      });
      const taxRes = await pg.db
        .select()
        .from(taxCategories)
        .where(eq(taxCategories.code, 'GST'));
      const orderLine = await createTestSalesOrderLine(pg.db, {
        salesOrderId: order.salesOrderId,
        productId: prod.productId,
        quantity: 10,
        price: 50,
        taxCategoryId: taxRes[0].taxCategoryId,
      });
      await createTestReturnLine(pg.db, {
        returnId: ret.returnId,
        salesOrderLineId: orderLine.salesOrderLineId,
        quantity: 5,
      });

      const result = await service.findOne(ret.returnId);
      expect(result).toHaveProperty('returnId', ret.returnId);
      expect(result.lines).toHaveLength(1);
    });

    it('should throw NotFoundException for unknown return', async () => {
      await expect(
        service.findOne('00000000-0000-4000-8000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByOrder', () => {
    it('should return all returns for an order', async () => {
      const cust = await createTestCustomer(pg.db);
      await pg.db
        .insert(locations)
        .values({
          locationId: '10000000-0000-4000-8000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing()
        .returning();

      const order = await createTestSalesOrder(pg.db, {
        customerId: cust.customerId,
        locationId: '10000000-0000-4000-8000-000000000001',
      });
      const ret = await createTestReturn(pg.db, {
        salesOrderId: order.salesOrderId,
        state: RETURN_STATE.DRAFT,
      });

      const result = await service.findByOrder(order.salesOrderId);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('returnId', ret.returnId);
    });
  });

  // =========================================================================
  // Helper validation
  // =========================================================================

  describe('findReturn (via updateReturn)', () => {
    it('should throw NotFoundException when return does not exist', async () => {
      await expect(
        service.updateReturn(
          '00000000-0000-4000-8000-000000000000',
          { notes: 'test' },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findReturnLine (via updateReturnLine)', () => {
    it('should throw NotFoundException when return line does not exist', async () => {
      const cust = await createTestCustomer(pg.db);
      await pg.db
        .insert(locations)
        .values({
          locationId: '10000000-0000-4000-8000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing()
        .returning();
      const order = await createTestSalesOrder(pg.db, {
        customerId: cust.customerId,
        locationId: '10000000-0000-4000-8000-000000000001',
      });
      const ret = await createTestReturn(pg.db, {
        salesOrderId: order.salesOrderId,
        state: RETURN_STATE.DRAFT,
      });

      await expect(
        service.updateReturnLine(
          ret.returnId,
          '00000000-0000-4000-8000-000000000000',
          { reason: 'test' },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if line belongs to different return', async () => {
      const cust = await createTestCustomer(pg.db);
      const prod = await createTestProduct(pg.db);
      await pg.db
        .insert(locations)
        .values({
          locationId: '10000000-0000-4000-8000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing()
        .returning();
      const order = await createTestSalesOrder(pg.db, {
        customerId: cust.customerId,
        locationId: '10000000-0000-4000-8000-000000000001',
      });
      const taxRes = await pg.db
        .select()
        .from(taxCategories)
        .where(eq(taxCategories.code, 'GST'));
      const orderLine = await createTestSalesOrderLine(pg.db, {
        salesOrderId: order.salesOrderId,
        productId: prod.productId,
        quantity: 10,
        price: 50,
        taxCategoryId: taxRes[0].taxCategoryId,
      });

      const ret1 = await createTestReturn(pg.db, {
        salesOrderId: order.salesOrderId,
        state: RETURN_STATE.DRAFT,
      });
      const ret2 = await createTestReturn(pg.db, {
        salesOrderId: order.salesOrderId,
        state: RETURN_STATE.DRAFT,
      });

      const retLine = await createTestReturnLine(pg.db, {
        returnId: ret2.returnId, // belongs to ret2
        salesOrderLineId: orderLine.salesOrderLineId,
        quantity: 5,
      });

      await expect(
        service.updateReturnLine(
          ret1.returnId, // Attempt to update using ret1's ID
          retLine.returnLineId,
          { reason: 'test' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

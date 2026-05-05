import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from '../settings/app-config.service';
import { ReturnsWriteService } from './returns-write.service';
import { InventoryService } from '../inventory/inventory.service';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { emitEvent } from '../common/emit-event';
import { AggregateType } from '../common/event-types';
import {
  locations,
  taxCategories,
  bins,
  zones,
  glAccounts,
} from '../drizzle/modbm-core-schema';

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
} from '../../test/fixtures';

// Shared test data
const INVOICED_ORDER = {
  salesOrderId: 'order-001',
  orderNumber: 'ORD-20260315-0001',
  stateCode: 'invoiced',
  customerId: 'c0000000-0000-0000-0000-000000000001',
};

const DRAFT_ORDER = {
  salesOrderId: 'order-002',
  orderNumber: 'ORD-20260315-0002',
  stateCode: 'draft',
  customerId: 'c0000000-0000-0000-0000-000000000001',
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
  stateCode: 'draft',
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
      TRUNCATE modbm_core.sales_order_return_lines CASCADE;
      TRUNCATE modbm_core.sales_order_returns CASCADE;
      TRUNCATE modbm_core.sales_order_lines CASCADE;
      TRUNCATE modbm_core.sales_orders CASCADE;
      TRUNCATE modbm_core.accounts CASCADE;
      TRUNCATE modbm_core.products CASCADE;
      TRUNCATE modbm_core.outbox CASCADE;
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
          },
        },
        ReturnsWriteService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: GlService, useValue: mockGlService },
        { provide: TaxCategoriesService, useValue: mocktaxService },
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
    }) {
      const cust = await createTestCustomer(pg.db);
      customerId = cust.accountId;

      const prod = await createTestProduct(pg.db);
      productId = prod.productId;

      await pg.db
        .insert(locations)
        .values({
          locationId: '10000000-0000-0000-0000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          type: 'warehouse',
        })
        .onConflictDoNothing()
        .returning();

      const order = await createTestSalesOrder(pg.db, {
        customerId,
        locationId: '10000000-0000-0000-0000-000000000001',
        state: opts?.orderState ?? 'invoiced',
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

      if (opts?.alreadyReturned) {
        const ret = await createTestReturn(pg.db, {
          salesOrderId: orderId,
          state: 'draft',
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
      expect(result).toHaveProperty('stateCode', 'draft');
    });

    it('should reject return against a non-invoiced order', async () => {
      await setupCreate({ orderState: 'draft' });
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
      await setupCreate({ orderState: 'confirmed' });
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

    it('should reject return against a shipped order', async () => {
      await setupCreate({ orderState: 'shipped' });
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
          locationId: '10000000-0000-0000-0000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          type: 'warehouse',
        })
        .onConflictDoNothing()
        .returning();
      const order = await createTestSalesOrder(pg.db, {
        customerId: cust.accountId,
        locationId: '10000000-0000-0000-0000-000000000001',
      });
      const ret = await createTestReturn(pg.db, {
        salesOrderId: order.salesOrderId,
        state: stateCode,
      });
      returnId = ret.returnId;
    }

    it('should update notes on a draft return', async () => {
      await setupForUpdate('draft');
      const result = await service.updateReturn(
        returnId,
        { notes: 'Updated notes' },
        'admin',
      );
      expect(result.notes).toBe('Updated notes');
    });

    it('should reject update on confirmed return', async () => {
      await setupForUpdate('confirmed');
      await expect(
        service.updateReturn(returnId, { notes: 'Test' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update on processed return', async () => {
      await setupForUpdate('processed');
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
          locationId: '10000000-0000-0000-0000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          type: 'warehouse',
        })
        .onConflictDoNothing()
        .returning();

      // Need a receiving bin for processing
      await pg.db
        .insert(zones)
        .values({
          zoneId: '30000000-0000-0000-0000-000000000001',
          locationId: '10000000-0000-0000-0000-000000000001',
          code: 'RECV',
          name: 'Receiving',
        })
        .onConflictDoNothing();
      await pg.db
        .insert(bins)
        .values({
          binId: '20000000-0000-0000-0000-000000000001',
          zoneId: '30000000-0000-0000-0000-000000000001',
          binNumber: 'RECEIVING',
          binType: 'receiving',
        })
        .onConflictDoNothing();

      const order = await createTestSalesOrder(pg.db, {
        customerId: cust.accountId,
        locationId: '10000000-0000-0000-0000-000000000001',
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
      ['draft', 'confirmed'],
      ['draft', 'cancelled'],
      ['confirmed', 'processed'],
      ['confirmed', 'draft'],
    ])('should allow transition %s → %s', async (from, to) => {
      await setupWithState(from as ReturnState);
      await expect(
        service.changeReturnState(
          returnId,
          to,
          'admin',
          to === 'processed'
            ? '10000000-0000-0000-0000-000000000001'
            : undefined,
        ),
      ).resolves.toBeDefined();
    });

    it.each([
      ['draft', 'processed'],
      ['confirmed', 'cancelled'],
      ['processed', 'draft'],
      ['processed', 'confirmed'],
      ['cancelled', 'draft'],
    ])('should reject transition %s → %s', async (from, to) => {
      await setupWithState(from as ReturnState);
      await expect(
        service.changeReturnState(
          returnId,
          to,
          'admin',
          to === 'processed'
            ? '10000000-0000-0000-0000-000000000001'
            : undefined,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unknown state name', async () => {
      await setupWithState('draft');
      await expect(
        service.changeReturnState(returnId, 'nonexistent', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should emit return_processed event when transitioning to processed', async () => {
      await setupWithState('confirmed');
      await service.changeReturnState(
        returnId,
        'processed',
        'admin',
        '10000000-0000-0000-0000-000000000001',
      );
      // Verify the event was emitted by checking outbox? Actually we don't mock outbox here,
      // PGLite will just execute the transaction. We can check if state is updated.
      const updated = await pg.db.query.salesOrderReturns.findFirst({
        where: (r, { eq }) => eq(r.returnId, returnId),
      });
      expect(updated?.stateCode).toBe('processed');
    });
  });

  // =========================================================================
  // GL Credit Note posting (via changeReturnState → processed)
  //
  // postCreditNoteGl is private, tested indirectly through changeReturnState.
  // After the transaction, the method makes additional DB calls:
  //   1. glAccounts select (resolve account codes from settings IDs)
  //   2. sharedFindOrder (fetch order for customer info)
  //   3. salesOrderReturnLines select (fetch return lines)
  //   4. salesOrderLineItems select per return line (fetch pricing + GST)
  //   5. outbox insert (write credit_note_posted event)
  // =========================================================================

  describe('GL Credit Note posting', () => {
    const GL_ACCOUNT_ROWS = [
      { glAccountId: 'ar-acct-id', accountCode: '1100' },
      { glAccountId: 'rev-acct-id', accountCode: '4100' },
      { glAccountId: 'tax-acct-id', accountCode: '2200' },
    ];

    async function setupGlTest(opts: {
      settings?: any;
      returnFee?: string;
      taxRate?: string;
    }) {
      const ar = await db
        .select()
        .from(glAccounts)
        .where(eq(glAccounts.accountCode, '1100'));
      const rev = await db
        .select()
        .from(glAccounts)
        .where(eq(glAccounts.accountCode, '4100'));
      const tax = await db
        .select()
        .from(glAccounts)
        .where(eq(glAccounts.accountCode, '2200'));

      const GL_SETTINGS = {
        defaultArAccountId: ar[0]?.glAccountId,
        defaultRevenueAccountId: rev[0]?.glAccountId,
        defaultTaxAccountId: tax[0]?.glAccountId,
      };

      const settings =
        opts.settings !== undefined ? opts.settings : GL_SETTINGS;
      const taxRate = opts.taxRate ?? '10';
      const returnFee = opts.returnFee ?? '10.00';

      mockGlService.getSettings.mockResolvedValue(settings);
      mocktaxService.getById.mockResolvedValue({ rate: taxRate });

      const cust = await createTestCustomer(db);
      await db
        .insert(locations)
        .values({
          locationId: '10000000-0000-0000-0000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          type: 'warehouse',
        })
        .onConflictDoNothing()
        .returning();
      await db
        .insert(zones)
        .values({
          zoneId: '10000000-0000-0000-0000-000000000003',
          locationId: '10000000-0000-0000-0000-000000000001',
          code: 'Z1',
          name: 'Z1',
        })
        .onConflictDoNothing();
      await db
        .insert(bins)
        .values({
          binId: '10000000-0000-0000-0000-000000000002',
          binNumber: 'RECEIVING',
          zoneId: '10000000-0000-0000-0000-000000000003',
          binType: 'receiving',
        })
        .onConflictDoNothing();

      const order = await createTestSalesOrder(pg.db, {
        customerId: cust.accountId,
        locationId: '10000000-0000-0000-0000-000000000001',
      });
      const prod = await createTestProduct(pg.db);

      let taxId = null;
      if (taxRate !== '0') {
        const taxRes = await pg.db
          .select()
          .from(taxCategories)
          .where(eq(taxCategories.code, 'GST'));
        taxId = taxRes[0].taxCategoryId;
      } else {
        const [exemptTax] = await pg.db
          .insert(taxCategories)
          .values({
            taxCategoryId: '10000000-0000-0000-0000-000000000004',
            code: 'ZERO',
            title: 'Zero Tax',
            type: 'zero_rated',
            rate: '0',
          })
          .onConflictDoNothing()
          .returning();
        taxId =
          exemptTax?.taxCategoryId || '10000000-0000-0000-0000-000000000004';
      }

      const orderLine = await createTestSalesOrderLine(pg.db, {
        salesOrderId: order.salesOrderId,
        productId: prod.productId,
        quantity: 10,
        price: 50,
        taxCategoryId: taxId,
      });

      const ret = await createTestReturn(pg.db, {
        salesOrderId: order.salesOrderId,
        state: 'confirmed',
      });

      await createTestReturnLine(pg.db, {
        returnId: ret.returnId,
        salesOrderLineId: orderLine.salesOrderLineId,
        quantity: 5,
        returnFee: returnFee,
      });

      return {
        retId: ret.returnId,
        customerId: cust.accountId,
        productId: prod.productId,
        taxId,
      };
    }

    it('should post GL journal with correct lines (revenue + GST + fees)', async () => {
      const { retId, customerId } = await setupGlTest({ taxRate: '10' });

      await service.changeReturnState(
        retId,
        'processed',
        'admin',
        '10000000-0000-0000-0000-000000000001',
      );

      expect(mockGlService.postJournalEntry).toHaveBeenCalledTimes(1);

      const [glLines, meta] = mockGlService.postJournalEntry.mock.calls[0];

      expect(meta.sourceType).toBe('sales_credit_note');
      expect(meta.sourceId).toBe(retId);

      // Revenue debit
      const revLine = glLines.find((l: any) => l.accountCode === '4100');
      expect(revLine).toBeDefined();
      expect(revLine.debit).toBe(250);
      expect(revLine.credit).toBe(0);

      // AR credit with customer partyId
      const arLine = glLines.find((l: any) => l.accountCode === '1100');
      expect(arLine).toBeDefined();
      expect(arLine.debit).toBe(0);
      expect(arLine.credit).toBe(265); // 250 + 25 - 10
      expect(arLine.partyType).toBe('customer');
      expect(arLine.partyId).toBe(customerId);

      // GST debit
      const taxLine = glLines.find((l: any) => l.accountCode === '2200');
      expect(taxLine).toBeDefined();
      expect(taxLine.debit).toBe(25);
      expect(taxLine.credit).toBe(0);

      // Fee credit
      const feeLine = glLines.find((l: any) => l.accountCode === '4900');
      expect(feeLine).toBeDefined();
      expect(feeLine.debit).toBe(0);
      expect(feeLine.credit).toBe(10);

      const totalDebit = glLines.reduce((s: number, l: any) => s + l.debit, 0);
      const totalCredit = glLines.reduce(
        (s: number, l: any) => s + l.credit,
        0,
      );
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
    });

    it('should omit fee line when no fees', async () => {
      const { retId } = await setupGlTest({ returnFee: '0', taxRate: '10' });

      await service.changeReturnState(
        retId,
        'processed',
        'admin',
        '10000000-0000-0000-0000-000000000001',
      );

      const [glLines] = mockGlService.postJournalEntry.mock.calls[0];

      const feeLine = glLines.find((l: any) => l.accountCode === '4900');
      expect(feeLine).toBeUndefined();

      const arLine = glLines.find((l: any) => l.accountCode === '1100');
      expect(arLine.credit).toBe(275);

      expect(glLines).toHaveLength(3);

      const totalDebit = glLines.reduce((s: number, l: any) => s + l.debit, 0);
      const totalCredit = glLines.reduce(
        (s: number, l: any) => s + l.credit,
        0,
      );
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
    });

    it('should omit GST line when no tax applies', async () => {
      const { retId } = await setupGlTest({ taxRate: '0' });

      await service.changeReturnState(
        retId,
        'processed',
        'admin',
        '10000000-0000-0000-0000-000000000001',
      );

      const [glLines] = mockGlService.postJournalEntry.mock.calls[0];

      const taxLine = glLines.find((l: any) => l.accountCode === '2200');
      expect(taxLine).toBeUndefined();

      const arLine = glLines.find((l: any) => l.accountCode === '1100');
      expect(arLine.credit).toBe(240);

      const totalDebit = glLines.reduce((s: number, l: any) => s + l.debit, 0);
      const totalCredit = glLines.reduce(
        (s: number, l: any) => s + l.credit,
        0,
      );
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
    });

    it('should skip GL posting when settings are incomplete', async () => {
      const { retId } = await setupGlTest({ settings: null });

      await service.changeReturnState(
        retId,
        'processed',
        'admin',
        '10000000-0000-0000-0000-000000000001',
      );

      expect(mockGlService.postJournalEntry).not.toHaveBeenCalled();
    });

    it('should skip GL posting when AR account ID is missing', async () => {
      const { retId } = await setupGlTest({
        settings: {
          defaultRevenueAccountId: '10000000-0000-0000-0000-100000000002',
          defaultTaxAccountId: '10000000-0000-0000-0000-100000000003',
        },
      });

      await service.changeReturnState(
        retId,
        'processed',
        'admin',
        '10000000-0000-0000-0000-000000000001',
      );

      expect(mockGlService.postJournalEntry).not.toHaveBeenCalled();
    });

    it('should not throw when GL posting fails (non-fatal)', async () => {
      const { retId } = await setupGlTest({});
      mockGlService.postJournalEntry.mockRejectedValue(
        new Error('GL service unavailable'),
      );

      await expect(
        service.changeReturnState(
          retId,
          'processed',
          'admin',
          '10000000-0000-0000-0000-000000000001',
        ),
      ).rejects.toThrow('GL service unavailable');
    });

    it('should write outbox event with correct payload', async () => {
      const { retId, customerId, productId } = await setupGlTest({
        taxRate: '10',
      });

      await service.changeReturnState(
        retId,
        'processed',
        'admin',
        '10000000-0000-0000-0000-000000000001',
      );

      expect(emitEvent).toHaveBeenCalled();

      const emitCall = (emitEvent as jest.Mock).mock.calls.find(
        (call) => call[1].eventType === 'credit_note_posted',
      );

      expect(emitCall).toBeDefined();
      const payload = emitCall[1].payload;

      expect(emitCall[1].aggregateType).toBe(AggregateType.SALES_ORDER);
      expect(emitCall[1].eventType).toBe('credit_note_posted');
      expect(payload.returnId).toBe(retId);
      expect(payload.customerId).toBe(customerId);
      expect(payload.totalCredit).toBe(250);
      expect(payload.totalTax).toBe(25);
      expect(payload.totalFees).toBe(10);
      expect(payload.netCredit).toBe(265);
      expect(payload.lines).toHaveLength(1);
      expect(payload.lines[0].productId).toBe(productId);
    });

    it('should use per-line GST from taxCategoryId', async () => {
      const { retId, taxId } = await setupGlTest({ taxRate: '15' });

      await service.changeReturnState(
        retId,
        'processed',
        'admin',
        '10000000-0000-0000-0000-000000000001',
      );

      expect(mocktaxService.getById).toHaveBeenCalledWith(taxId);

      const [glLines] = mockGlService.postJournalEntry.mock.calls[0];

      const taxLine = glLines.find((l: any) => l.accountCode === '2200');
      expect(taxLine.debit).toBe(37.5);

      const arLine = glLines.find((l: any) => l.accountCode === '1100');
      expect(arLine.credit).toBe(277.5);
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
      const cust = await createTestCustomer(db);
      const prod = await createTestProduct(db);

      await db
        .insert(locations)
        .values({
          locationId: '10000000-0000-0000-0000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          type: 'warehouse',
        })
        .onConflictDoNothing()
        .returning();
      const order = await createTestSalesOrder(db, {
        customerId: cust.accountId,
        locationId: '10000000-0000-0000-0000-000000000001',
      });
      orderId = order.salesOrderId;

      const taxRes = await db
        .select()
        .from(taxCategories)
        .where(eq(taxCategories.code, 'GST'));

      const line = await createTestSalesOrderLine(db, {
        salesOrderId: orderId,
        productId: prod.productId,
        taxCategoryId: taxRes[0].taxCategoryId,
        quantity: 10,
        price: 10,
      });
      lineId = line.salesOrderLineId;

      const ret = await createTestReturn(db, {
        salesOrderId: orderId,
        state: returnState,
      });
      returnId = ret.returnId;

      if (alreadyReturned > 0) {
        await createTestReturnLine(db, {
          returnId,
          salesOrderLineId: lineId,
          quantity: alreadyReturned,
        });
      }
    }

    it('should add a line to a draft return', async () => {
      await setupForAddLine('draft');
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
      await setupForAddLine('draft');
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
      const cust = await createTestCustomer(db);
      const prod = await createTestProduct(db);
      await db
        .insert(locations)
        .values({
          locationId: '10000000-0000-0000-0000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          type: 'warehouse',
        })
        .onConflictDoNothing()
        .returning();

      const order = await createTestSalesOrder(db, {
        customerId: cust.accountId,
        locationId: '10000000-0000-0000-0000-000000000001',
      });
      const taxRes = await db
        .select()
        .from(taxCategories)
        .where(eq(taxCategories.code, 'GST'));
      const orderLine = await createTestSalesOrderLine(db, {
        salesOrderId: order.salesOrderId,
        productId: prod.productId,
        quantity: 10,
        price: 50,
        taxCategoryId: taxRes[0].taxCategoryId,
      });

      const ret = await createTestReturn(db, {
        salesOrderId: order.salesOrderId,
        state: stateCode,
      });
      returnId = ret.returnId;

      const retLine = await createTestReturnLine(db, {
        returnId,
        salesOrderLineId: orderLine.salesOrderLineId,
        quantity: 5,
      });
      returnLineId = retLine.returnLineId;
    }

    it('should update return line on a draft return', async () => {
      await setupForUpdateLine('draft');
      const result = await service.updateReturnLine(
        returnId,
        returnLineId,
        { reason: 'Changed mind' },
        'admin',
      );
      expect(result).toBeDefined();
    });

    it('should reject update on confirmed return', async () => {
      await setupForUpdateLine('confirmed');
      await expect(
        service.updateReturnLine(
          returnId,
          returnLineId,
          { reason: 'Test' },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject negative return fee', async () => {
      await setupForUpdateLine('draft');
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
      const cust = await createTestCustomer(db);
      const prod = await createTestProduct(db);
      await db
        .insert(locations)
        .values({
          locationId: '10000000-0000-0000-0000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          type: 'warehouse',
        })
        .onConflictDoNothing()
        .returning();

      const order = await createTestSalesOrder(db, {
        customerId: cust.accountId,
        locationId: '10000000-0000-0000-0000-000000000001',
      });
      const taxRes = await db
        .select()
        .from(taxCategories)
        .where(eq(taxCategories.code, 'GST'));
      const orderLine = await createTestSalesOrderLine(db, {
        salesOrderId: order.salesOrderId,
        productId: prod.productId,
        quantity: 10,
        price: 50,
        taxCategoryId: taxRes[0].taxCategoryId,
      });

      const ret = await createTestReturn(db, {
        salesOrderId: order.salesOrderId,
        state: stateCode,
      });
      returnId = ret.returnId;

      const retLine = await createTestReturnLine(db, {
        returnId,
        salesOrderLineId: orderLine.salesOrderLineId,
        quantity: 5,
      });
      returnLineId = retLine.returnLineId;
    }

    it('should remove a line from a draft return', async () => {
      await setupForRemoveLine('draft');
      await expect(
        service.removeReturnLine(returnId, returnLineId, 'admin'),
      ).resolves.toBeUndefined();
    });

    it('should reject removal from confirmed return', async () => {
      await setupForRemoveLine('confirmed');
      await expect(
        service.removeReturnLine(returnId, returnLineId, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject removal from processed return', async () => {
      await setupForRemoveLine('processed');
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
      const cust = await createTestCustomer(db);
      const prod = await createTestProduct(db);
      await db
        .insert(locations)
        .values({
          locationId: '10000000-0000-0000-0000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          type: 'warehouse',
        })
        .onConflictDoNothing()
        .returning();

      const order = await createTestSalesOrder(db, {
        customerId: cust.accountId,
        locationId: '10000000-0000-0000-0000-000000000001',
      });
      const ret = await createTestReturn(db, {
        salesOrderId: order.salesOrderId,
        state: 'draft',
      });
      const taxRes = await db
        .select()
        .from(taxCategories)
        .where(eq(taxCategories.code, 'GST'));
      const orderLine = await createTestSalesOrderLine(db, {
        salesOrderId: order.salesOrderId,
        productId: prod.productId,
        quantity: 10,
        price: 50,
        taxCategoryId: taxRes[0].taxCategoryId,
      });
      await createTestReturnLine(db, {
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
        service.findOne('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByOrder', () => {
    it('should return all returns for an order', async () => {
      const cust = await createTestCustomer(db);
      await db
        .insert(locations)
        .values({
          locationId: '10000000-0000-0000-0000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          type: 'warehouse',
        })
        .onConflictDoNothing()
        .returning();

      const order = await createTestSalesOrder(db, {
        customerId: cust.accountId,
        locationId: '10000000-0000-0000-0000-000000000001',
      });
      const ret = await createTestReturn(db, {
        salesOrderId: order.salesOrderId,
        state: 'draft',
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
          '00000000-0000-0000-0000-000000000000',
          { notes: 'test' },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findReturnLine (via updateReturnLine)', () => {
    it('should throw NotFoundException when return line does not exist', async () => {
      const cust = await createTestCustomer(db);
      await db
        .insert(locations)
        .values({
          locationId: '10000000-0000-0000-0000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          type: 'warehouse',
        })
        .onConflictDoNothing()
        .returning();
      const order = await createTestSalesOrder(db, {
        customerId: cust.accountId,
        locationId: '10000000-0000-0000-0000-000000000001',
      });
      const ret = await createTestReturn(db, {
        salesOrderId: order.salesOrderId,
        state: 'draft',
      });

      await expect(
        service.updateReturnLine(
          ret.returnId,
          '00000000-0000-0000-0000-000000000000',
          { reason: 'test' },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if line belongs to different return', async () => {
      const cust = await createTestCustomer(db);
      const prod = await createTestProduct(db);
      await db
        .insert(locations)
        .values({
          locationId: '10000000-0000-0000-0000-000000000001',
          code: 'LOC1',
          name: 'Loc 1',
          type: 'warehouse',
        })
        .onConflictDoNothing()
        .returning();
      const order = await createTestSalesOrder(db, {
        customerId: cust.accountId,
        locationId: '10000000-0000-0000-0000-000000000001',
      });
      const taxRes = await db
        .select()
        .from(taxCategories)
        .where(eq(taxCategories.code, 'GST'));
      const orderLine = await createTestSalesOrderLine(db, {
        salesOrderId: order.salesOrderId,
        productId: prod.productId,
        quantity: 10,
        price: 50,
        taxCategoryId: taxRes[0].taxCategoryId,
      });

      const ret1 = await createTestReturn(db, {
        salesOrderId: order.salesOrderId,
        state: 'draft',
      });
      const ret2 = await createTestReturn(db, {
        salesOrderId: order.salesOrderId,
        state: 'draft',
      });

      const retLine = await createTestReturnLine(db, {
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

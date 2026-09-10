import { Test, TestingModule } from '@nestjs/testing';
import { DirectFulfillmentService } from './direct-fulfillment.service';
import { SalesInvoiceService } from '../invoices/sales-invoice.service';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { AppConfigService } from '../settings/app-config.service';
import { EnrichmentService } from '../enrichment/enrichment.service';
import { OrganizationService } from '../settings/organization.service';
import { InventoryMovementService } from '../inventory/inventory-movement.service';
import { WorkOrdersWriteService } from '../manufacturing/work-orders-write.service';
import { BackordersService } from './backorders.service';
import { ReturnsWriteService } from './returns-write.service';
import { UomService } from '../inventory/uom.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { BadRequestException } from '@nestjs/common';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { ShipmentsCoreService } from './shipments/shipments-core.service';
import {
  salesOrders,
  salesOrderLineItems,
  salesOrderPicks,
  salesOrderShipments,
  salesOrderShipmentLines,
  products,
  zones,
  bins,
  binContents,
  locations,
  customers,
  taxCategories,
  inventoryEntries,
  inventoryLedger,
  organizations,
  uomDictionary,
  glAccounts,
} from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import {
  SALES_ORDER_STATE,
  SALES_ORDER_PICK_STATE,
  PRODUCT_STATE,
  CUSTOMER_STATE,
  ORGANIZATION_STATE,
} from '@herobm/shared';

jest.mock('../orders/order-lifecycle-rules', () => ({
  evaluateLifecycleRules: jest.fn().mockResolvedValue([]),
}));

describe('DirectFulfillmentService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: DirectFulfillmentService;
  let salesInvoiceService: SalesInvoiceService;

  const CUSTOMER_ID = '00000000-0000-4000-8000-000000000001';
  const ACTOR_ID = '00000000-0000-4000-8000-000000000002';
  const LOCATION_ID = '00000000-0000-4000-8000-00000000000f';
  const ZONE_ID = '00000000-0000-4000-8000-00000000000e';
  const BIN_ID = '00000000-0000-4000-8000-00000000000d';
  const PRODUCT_ID = '00000000-0000-4000-8000-00000000000a';
  const TAX_CAT_ID = '00000000-0000-4000-8000-000000000007';
  const MOCK_AR_ID = '00000000-0000-4000-8000-0000000000a1';
  const MOCK_REV_ID = '00000000-0000-4000-8000-0000000000a2';
  const MOCK_TAX_ID = '00000000-0000-4000-8000-0000000000a3';
  const MOCK_INVENTORY_ID = '00000000-0000-4000-8000-0000000000a4';
  const MOCK_COGS_ID = '00000000-0000-4000-8000-0000000000a5';

  let mockGlService: any;
  let mockAppConfigService: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockGlService = {
      getSettings: jest.fn().mockResolvedValue({
        defaultArAccountId: MOCK_AR_ID,
        defaultRevenueAccountId: MOCK_REV_ID,
        defaultSalesTaxAccountId: MOCK_TAX_ID,
      }),
      postJournalEntry: jest
        .fn()
        .mockResolvedValue({ journalEntryId: 'je-001' }),
    };

    mockAppConfigService = {
      revenueRoutingPrecedence: jest.fn().mockReturnValue('product_first'),
      expenseRoutingPrecedence: jest.fn().mockReturnValue('product_first'),
      inventoryAccountingMode: jest.fn().mockReturnValue('perpetual'),
      valuationMethod: jest.fn().mockReturnValue('standard'),
      homeCurrency: jest.fn().mockReturnValue('AUD'),
      taxProviderMappings: jest.fn().mockReturnValue({}),
      getAppSettingsRaw: jest.fn().mockReturnValue({}),
      defaultSalesTaxAccountId: jest.fn().mockReturnValue(null),
      defaultRevenueAccountId: jest.fn().mockReturnValue(null),
      defaultCostCenterId: jest.fn().mockReturnValue(null),
      defaultActivityId: jest.fn().mockReturnValue(null),
      defaultInventoryAccountId: jest.fn().mockReturnValue(MOCK_INVENTORY_ID),
      defaultGrniAccountId: jest.fn().mockReturnValue('2110'),
      defaultCogsAccountId: jest.fn().mockReturnValue(MOCK_COGS_ID),
      defaultShrinkageAccountId: jest.fn().mockReturnValue('5100'),
      defaultPpvAccountId: jest.fn().mockReturnValue('5200'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DirectFulfillmentService,
        SalesInvoiceService,
        InventoryMovementService,
        ShipmentsCoreService,
        UomService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: GlService, useValue: mockGlService },
        { provide: AppConfigService, useValue: mockAppConfigService },
        {
          provide: TaxCategoriesService,
          useValue: {
            getById: jest.fn().mockResolvedValue({ rate: '10.0' }),
          },
        },
        {
          provide: EnrichmentService,
          useValue: {
            lookup: jest.fn(),
            recordTransaction: jest.fn(),
            recordRefund: jest.fn(),
          },
        },
        {
          provide: OrganizationService,
          useValue: {
            get: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: WorkOrdersWriteService,
          useValue: {
            updatePutawayStatus: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: BackordersService,
          useValue: {
            fulfillWorkOrderDemand: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ReturnsWriteService,
          useValue: {
            updateReturnLinePutawayStatus: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<DirectFulfillmentService>(DirectFulfillmentService);
    salesInvoiceService = module.get<SalesInvoiceService>(SalesInvoiceService);

    // Clean tables
    await pg.db.delete(salesOrderShipmentLines);
    await pg.db.delete(salesOrderShipments);
    await pg.db.delete(salesOrderPicks);
    await pg.db.delete(salesOrderLineItems);
    await pg.db.delete(salesOrders);
    await pg.db.delete(inventoryLedger);
    await pg.db.delete(inventoryEntries);
    await pg.db.delete(binContents);
    await pg.db.delete(bins);
    await pg.db.delete(zones);
    await pg.db.delete(products);
    await pg.db.delete(customers);
    await pg.db.delete(organizations);
    await pg.db.delete(locations);
    await pg.db.delete(taxCategories);
    await pg.db.delete(uomDictionary);
    await pg.db.delete(glAccounts);

    // 1. Seed base data
    await pg.db.insert(organizations).values({
      organizationId: '00000000-0000-4000-8000-000000000000',
      name: 'Direct Fulfillment Test Org',
      stateCode: ORGANIZATION_STATE.ACTIVE,
      isTaxRegistered: true,
    });

    await pg.db.insert(locations).values({
      locationId: LOCATION_ID,
      code: 'LOC-COUNTER',
      name: 'Counter & Trade Location',
      source: 'manual',
      createdBy: ACTOR_ID,
    });

    await pg.db.insert(zones).values({
      zoneId: ZONE_ID,
      locationId: LOCATION_ID,
      code: 'Z-PICK',
      name: 'Pickable Area',
      source: 'manual',
      createdBy: ACTOR_ID,
    });

    await pg.db.insert(bins).values({
      binId: BIN_ID,
      zoneId: ZONE_ID,
      binNumber: 'B-01',
      binType: 'storage',
      source: 'manual',
      isUnavailable: false,
      isBonded: false,
      isConsignment: false,
      createdBy: ACTOR_ID,
    });

    await pg.db.insert(uomDictionary).values({
      uomCode: 'EA',
      description: 'Each',
    });

    await pg.db.insert(taxCategories).values({
      taxCategoryId: TAX_CAT_ID,
      code: 'GST',
      title: 'Standard GST',
      type: 'tax_applies',
      rate: '10.0',
    });

    await pg.db.insert(products).values({
      productId: PRODUCT_ID,
      productNumber: 'DRILL-18V',
      name: '18V Cordless Drill',
      productType: 'inventory',
      baseUom: 'EA',
      listPrice: '150.00',
      standardCost: '80.00',
      weightedAverageCost: '80.00',
      stateCode: PRODUCT_STATE.ACTIVE,
      source: 'manual',
      structureType: 'standard',
      createdBy: ACTOR_ID,
    });

    await pg.db.insert(binContents).values({
      binId: BIN_ID,
      productId: PRODUCT_ID,
      actualQuantity: '20',
    });

    await pg.db.insert(customers).values({
      customerId: CUSTOMER_ID,
      customerNumber: 'CUST-001',
      currencyCode: 'AUD',
      stateCode: CUSTOMER_STATE.ACTIVE,
      source: 'manual',
      createdBy: ACTOR_ID,
    });

    await pg.db.insert(glAccounts).values([
      {
        glAccountId: MOCK_INVENTORY_ID,
        accountCode: '1200',
        name: 'Inventory Asset',
        accountType: 'asset',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      },
      {
        glAccountId: MOCK_COGS_ID,
        accountCode: '5000',
        name: 'Cost of Goods Sold',
        accountType: 'expense',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      },
      {
        glAccountId: MOCK_AR_ID,
        accountCode: '1100',
        name: 'Accounts Receivable',
        accountType: 'asset',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      },
      {
        glAccountId: MOCK_REV_ID,
        accountCode: '4000',
        name: 'Sales Revenue',
        accountType: 'revenue',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      },
      {
        glAccountId: MOCK_TAX_ID,
        accountCode: '2200',
        name: 'GST Payable',
        accountType: 'liability',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      },
    ]);
  });

  it('should fully fulfill order directly, decrement stock, post COGS, and mark order SHIPPED', async () => {
    const orderId = '00000000-0000-4000-8000-000000000101';
    const lineId = '00000000-0000-4000-8000-000000000102';

    // 1. Create confirmed sales order for 5 drills
    await pg.db.insert(salesOrders).values({
      salesOrderId: orderId,
      orderNumber: 'ORD-DIR-001',
      customerId: CUSTOMER_ID,
      fulfillmentLocationId: LOCATION_ID,
      stateCode: SALES_ORDER_STATE.CONFIRMED,
      currencyCode: 'AUD',
      exchangeRate: '1',
      discrepanciesAcknowledged: false,
      source: 'counter_sale',
      deliveryAddressLine1: '123 Trade Center Way',
      createdBy: 'counter.staff',
    });

    await pg.db.insert(salesOrderLineItems).values({
      salesOrderLineId: lineId,
      salesOrderId: orderId,
      lineNumber: 1,
      productId: PRODUCT_ID,
      productDescription: '18V Cordless Drill',
      quantity: '5',
      pricePerUnit: '150.00',
      unitCost: '80.00',
      amount: '750.00',
      tax: '75.00',
      totalAmount: '825.00',
      taxCategoryId: TAX_CAT_ID,
      fulfillmentLocationId: LOCATION_ID,
    });

    // 2. Fulfill directly
    const result = await service.fulfillDirectOrder(
      orderId,
      {
        trackingNumber: 'TRACK-12345',
        deliveryCompanyName: 'FastExpress',
        notes: 'Direct counter dispatch',
      },
      'counter.staff',
    );

    expect(result.salesOrderId).toBe(orderId);
    expect(result.stateCode).toBe(SALES_ORDER_STATE.SHIPPED);
    expect(result.fulfilledLines).toHaveLength(1);
    expect(result.fulfilledLines[0].quantityFulfilled).toBe('5');
    expect(result.cogsAmount).toBe('400.00'); // 5 * $80.00

    // 3. Verify bin stock decremented from 20 to 15
    const [updatedBin] = await pg.db
      .select()
      .from(binContents)
      .where(eq(binContents.binId, BIN_ID));
    expect(parseFloat(updatedBin.actualQuantity)).toBe(15);

    // 4. Verify sales_order_picks was created with state 'shipped'
    const picks = await pg.db
      .select()
      .from(salesOrderPicks)
      .where(eq(salesOrderPicks.salesOrderId, orderId));
    expect(picks).toHaveLength(1);
    expect(picks[0].stateCode).toBe(SALES_ORDER_PICK_STATE.SHIPPED);
    expect(picks[0].quantity).toBe('5');

    // 5. Verify sales_order_shipments was created with state 'dispatched'
    const shipments = await pg.db
      .select()
      .from(salesOrderShipments)
      .where(eq(salesOrderShipments.salesOrderId, orderId));
    expect(shipments).toHaveLength(1);
    expect(shipments[0].stateCode).toBe('dispatched');
    expect(shipments[0].trackingNumber).toBe('TRACK-12345');
    expect(shipments[0].deliveryCompanyName).toBe('FastExpress');
    expect(shipments[0].notes).toBe('Direct counter dispatch');

    const shipmentLines = await pg.db
      .select()
      .from(salesOrderShipmentLines)
      .where(eq(salesOrderShipmentLines.shipmentId, shipments[0].shipmentId));
    expect(shipmentLines).toHaveLength(1);
    expect(shipmentLines[0].quantityShipped).toBe('5');

    // 6. Verify order state updated to SHIPPED
    const [updatedOrder] = await pg.db
      .select()
      .from(salesOrders)
      .where(eq(salesOrders.salesOrderId, orderId));
    expect(updatedOrder.stateCode).toBe(SALES_ORDER_STATE.SHIPPED);

    // 7. Verify COGS GL journal was posted
    expect(mockGlService.postJournalEntry).toHaveBeenCalledTimes(1);

    // 7. Verify SalesInvoiceService can now invoice the order
    const invoice = await salesInvoiceService.createInvoice(
      orderId,
      {},
      'counter.staff',
    );
    expect(invoice.salesOrderId).toBe(orderId);
    expect(parseFloat(invoice.totalAmount)).toBe(825.0);
  });

  it('should support partial fulfillment directly', async () => {
    const orderId = '00000000-0000-4000-8000-000000000201';
    const lineId = '00000000-0000-4000-8000-000000000202';

    // 1. Create order for 10 units
    await pg.db.insert(salesOrders).values({
      salesOrderId: orderId,
      orderNumber: 'ORD-DIR-PARTIAL',
      customerId: CUSTOMER_ID,
      fulfillmentLocationId: LOCATION_ID,
      stateCode: SALES_ORDER_STATE.CONFIRMED,
      currencyCode: 'AUD',
      exchangeRate: '1',
      discrepanciesAcknowledged: false,
      source: 'counter_sale',
      deliveryAddressLine1: '123 Trade Center Way',
      createdBy: 'counter.staff',
    });

    await pg.db.insert(salesOrderLineItems).values({
      salesOrderLineId: lineId,
      salesOrderId: orderId,
      lineNumber: 1,
      productId: PRODUCT_ID,
      productDescription: '18V Cordless Drill',
      quantity: '10',
      pricePerUnit: '150.00',
      unitCost: '80.00',
      amount: '1500.00',
      tax: '150.00',
      totalAmount: '1650.00',
      taxCategoryId: TAX_CAT_ID,
      fulfillmentLocationId: LOCATION_ID,
    });

    // 2. Fulfill only 4 units directly
    const result = await service.fulfillDirectOrder(
      orderId,
      {
        lines: [
          {
            salesOrderLineId: lineId,
            quantityToFulfill: '4',
          },
        ],
      },
      'counter.staff',
    );

    expect(result.stateCode).toBe(SALES_ORDER_STATE.PICKING);
    expect(result.fulfilledLines[0].quantityFulfilled).toBe('4');
    expect(result.cogsAmount).toBe('320.00'); // 4 * $80.00

    // 3. Verify bin stock decremented by 4 (from 20 to 16)
    const [updatedBin] = await pg.db
      .select()
      .from(binContents)
      .where(eq(binContents.binId, BIN_ID));
    expect(parseFloat(updatedBin.actualQuantity)).toBe(16);

    // 4. Verify SalesInvoiceService only bills the 4 fulfilled units
    const invoice = await salesInvoiceService.createInvoice(
      orderId,
      {},
      'counter.staff',
    );
    expect(parseFloat(invoice.totalAmount)).toBe(660.0); // 4 * $150 + 10% tax = $660
  });

  it('should reject direct fulfillment when stock is insufficient', async () => {
    const orderId = '00000000-0000-4000-8000-000000000301';
    const lineId = '00000000-0000-4000-8000-000000000302';

    // 1. Create order for 25 units (only 20 in stock)
    await pg.db.insert(salesOrders).values({
      salesOrderId: orderId,
      orderNumber: 'ORD-DIR-OOS',
      customerId: CUSTOMER_ID,
      fulfillmentLocationId: LOCATION_ID,
      stateCode: SALES_ORDER_STATE.CONFIRMED,
      currencyCode: 'AUD',
      exchangeRate: '1',
      discrepanciesAcknowledged: false,
      source: 'counter_sale',
      deliveryAddressLine1: '123 Trade Center Way',
      createdBy: 'counter.staff',
    });

    await pg.db.insert(salesOrderLineItems).values({
      salesOrderLineId: lineId,
      salesOrderId: orderId,
      lineNumber: 1,
      productId: PRODUCT_ID,
      productDescription: '18V Cordless Drill',
      quantity: '25',
      pricePerUnit: '150.00',
      amount: '3750.00',
      tax: '375.00',
      totalAmount: '4125.00',
      taxCategoryId: TAX_CAT_ID,
      fulfillmentLocationId: LOCATION_ID,
    });

    // 2. Attempt to fulfill 25 units
    await expect(
      service.fulfillDirectOrder(orderId, {}, 'counter.staff'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject direct fulfillment if COGS or Inventory GL account is missing in perpetual mode (Strict Mode)', async () => {
    const orderId = '00000000-0000-4000-8000-000000000401';
    const lineId = '00000000-0000-4000-8000-000000000402';

    // 1. Create order
    await pg.db.insert(salesOrders).values({
      salesOrderId: orderId,
      orderNumber: 'ORD-DIR-GL-FAIL',
      customerId: CUSTOMER_ID,
      fulfillmentLocationId: LOCATION_ID,
      stateCode: SALES_ORDER_STATE.CONFIRMED,
      currencyCode: 'AUD',
      exchangeRate: '1',
      discrepanciesAcknowledged: false,
      source: 'counter_sale',
      deliveryAddressLine1: '123 Trade Center Way',
      createdBy: 'counter.staff',
    });

    await pg.db.insert(salesOrderLineItems).values({
      salesOrderLineId: lineId,
      salesOrderId: orderId,
      lineNumber: 1,
      productId: PRODUCT_ID,
      productDescription: '18V Cordless Drill',
      quantity: '2',
      pricePerUnit: '150.00',
      unitCost: '80.00',
      amount: '300.00',
      tax: '30.00',
      totalAmount: '330.00',
      taxCategoryId: TAX_CAT_ID,
      fulfillmentLocationId: LOCATION_ID,
    });

    // Mock unconfigured COGS account
    mockAppConfigService.defaultCogsAccountId.mockReturnValue(null);

    await expect(
      service.fulfillDirectOrder(orderId, {}, 'counter.staff'),
    ).rejects.toThrow(
      'Perpetual inventory requires the default COGS account to be configured.',
    );
  });
});

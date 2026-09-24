import { Test, TestingModule } from '@nestjs/testing';
import { TransfersStateService } from './transfers-state.service';
import { TransfersCoreService } from './transfers-core.service';
import { TransfersWriteService } from './transfers-write.service';
import { InventoryMovementService } from '../../inventory/inventory-movement.service';
import { InventoryQueryService } from '../../inventory/inventory-query.service';
import { ProjectsInventoryService } from '../../projects/projects-inventory.service';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import { setupPgliteSuite } from '../../test-utils/pglite-suite';
import {
  transferOrders,
  transferOrderLines,
  transferOrderPicks,
  transferOrderShipments,
  transferOrderShipmentLines,
  transferOrderReceipts,
  transferOrderReceiptLines,
  locations,
  zones,
  bins,
  binContents,
  products,
  uomDictionary,
  taxCategories,
  projects,
  customers,
} from '@herobm/db-schema';
import { eq, and } from 'drizzle-orm';
import {
  TRANSFER_ORDER_STATE,
  PRODUCT_STATE,
  SHIPMENT_STATE,
  PUTAWAY_STATUS,
  CUSTOMER_STATE,
  PROJECT_STATE,
  PROJECT_BILLING_TYPE,
} from '@herobm/shared';
import { BadRequestException } from '@nestjs/common';
import { BackordersService } from '../backorders.service';
import { AppConfigService } from '../../settings/app-config.service';
import { UomService } from '../../inventory/uom.service';
import { GlService } from '../../gl/gl.service';
import { WorkOrdersWriteService } from '../../manufacturing/work-orders-write.service';
import { ReturnsWriteService } from '../returns-write.service';

describe('Transfer Orders - Multi-Leg & Multi-Shipment Integration', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let stateService: TransfersStateService;
  let coreService: TransfersCoreService;
  let writeService: TransfersWriteService;
  let inventoryMovementService: InventoryMovementService;
  let mockProjectsInventoryService: {
    recordProjectReturnCredit: jest.Mock;
    recordProjectStagingCharge: jest.Mock;
  };
  let binSrcShipping: string;
  let binSrcTransit: string;
  let binDstReceiving: string;

  const LOCATION_SRC_ID = '00000000-0000-4000-8000-000000000101';
  const LOCATION_DST_ID = '00000000-0000-4000-8000-000000000102';

  const ZONE_SRC_ID = '00000000-0000-4000-8000-000000000110';
  const ZONE_DST_ID = '00000000-0000-4000-8000-000000000120';

  const BIN_SRC_STORAGE_A = '00000000-0000-4000-8000-000000000111';
  const BIN_SRC_STORAGE_B = '00000000-0000-4000-8000-000000000112';

  const BIN_DST_STORAGE_A = '00000000-0000-4000-8000-000000000122';
  const BIN_DST_STORAGE_B = '00000000-0000-4000-8000-000000000123';

  const PROD_A_ID = '00000000-0000-4000-8000-000000000131';
  const PROD_B_ID = '00000000-0000-4000-8000-000000000132';

  beforeEach(async () => {
    mockProjectsInventoryService = {
      recordProjectReturnCredit: jest.fn().mockResolvedValue(undefined),
      recordProjectStagingCharge: jest.fn().mockResolvedValue(undefined),
    };

    await pg.db
      .insert(uomDictionary)
      .values({ uomCode: 'EA', description: 'Each', category: 'goods' });

    await pg.db.insert(taxCategories).values({
      taxCategoryId: '00000000-0000-4000-8000-000000000000',
      code: 'GST',
      title: 'GST',
      rate: '0.1',
      type: 'tax_applies',
    });

    await pg.db.insert(locations).values([
      {
        locationId: LOCATION_SRC_ID,
        code: 'SRC-WH',
        name: 'Source Warehouse',
        source: 'app',
        createdBy: 'system',
      },
      {
        locationId: LOCATION_DST_ID,
        code: 'DST-WH',
        name: 'Destination Warehouse',
        source: 'app',
        createdBy: 'system',
      },
    ]);

    await pg.db.insert(zones).values([
      {
        zoneId: ZONE_SRC_ID,
        locationId: LOCATION_SRC_ID,
        code: 'SRC-Z',
        name: 'Source Zone',
        source: 'app',
        createdBy: 'system',
      },
      {
        zoneId: ZONE_DST_ID,
        locationId: LOCATION_DST_ID,
        code: 'DST-Z',
        name: 'Destination Zone',
        source: 'app',
        createdBy: 'system',
      },
    ]);

    await pg.db.insert(bins).values([
      // Source Location Storage Bins
      {
        binId: BIN_SRC_STORAGE_A,
        binNumber: 'SRC-A-01',
        zoneId: ZONE_SRC_ID,
        binType: 'storage',
        source: 'app',
        createdBy: 'system',
        isUnavailable: false,
        isBonded: false,
      },
      {
        binId: BIN_SRC_STORAGE_B,
        binNumber: 'SRC-B-01',
        zoneId: ZONE_SRC_ID,
        binType: 'storage',
        source: 'app',
        createdBy: 'system',
        isUnavailable: false,
        isBonded: false,
      },
      // Destination Location Storage Bins
      {
        binId: BIN_DST_STORAGE_A,
        binNumber: 'DST-A-01',
        zoneId: ZONE_DST_ID,
        binType: 'storage',
        source: 'app',
        createdBy: 'system',
        isUnavailable: false,
        isBonded: false,
      },
      {
        binId: BIN_DST_STORAGE_B,
        binNumber: 'DST-B-01',
        zoneId: ZONE_DST_ID,
        binType: 'storage',
        source: 'app',
        createdBy: 'system',
        isUnavailable: false,
        isBonded: false,
      },
    ]);

    const allBins = await pg.db
      .select({
        binId: bins.binId,
        binNumber: bins.binNumber,
        locationId: zones.locationId,
      })
      .from(bins)
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId));

    binSrcShipping = allBins.find(
      (b) => b.locationId === LOCATION_SRC_ID && b.binNumber === 'SHIPPING',
    )!.binId;
    binSrcTransit = allBins.find(
      (b) =>
        b.locationId === LOCATION_SRC_ID && b.binNumber === 'INTRA_TRANSIT',
    )!.binId;
    binDstReceiving = allBins.find(
      (b) => b.locationId === LOCATION_DST_ID && b.binNumber === 'RECEIVING',
    )!.binId;

    await pg.db.insert(products).values([
      {
        productId: PROD_A_ID,
        productNumber: 'PROD-A',
        name: 'Product Alpha',
        productType: 'inventory',
        structureType: 'standard',
        baseUom: 'EA',
        stateCode: PRODUCT_STATE.ACTIVE,
        salesTaxCategoryId: '00000000-0000-4000-8000-000000000000',
        purchaseTaxCategoryId: '00000000-0000-4000-8000-000000000000',
        source: 'app',
        createdBy: 'system',
      },
      {
        productId: PROD_B_ID,
        productNumber: 'PROD-B',
        name: 'Product Beta',
        productType: 'inventory',
        structureType: 'standard',
        baseUom: 'EA',
        stateCode: PRODUCT_STATE.ACTIVE,
        salesTaxCategoryId: '00000000-0000-4000-8000-000000000000',
        purchaseTaxCategoryId: '00000000-0000-4000-8000-000000000000',
        source: 'app',
        createdBy: 'system',
      },
    ]);

    // Initial stock in source bins
    await pg.db.insert(binContents).values([
      {
        binId: BIN_SRC_STORAGE_A,
        productId: PROD_A_ID,
        actualQuantity: '100',
      },
      {
        binId: BIN_SRC_STORAGE_B,
        productId: PROD_B_ID,
        actualQuantity: '50',
      },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersStateService,
        TransfersCoreService,
        TransfersWriteService,
        InventoryMovementService,
        InventoryQueryService,
        UomService,
        {
          provide: DRIZZLE,
          useValue: pg.db,
        },
        {
          provide: AppConfigService,
          useValue: {
            defaultFulfillmentLocationId: jest
              .fn()
              .mockReturnValue(LOCATION_SRC_ID),
            allowNegativeInventory: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: GlService,
          useValue: {
            getSettings: jest.fn().mockResolvedValue(null),
            postJournalEntry: jest.fn(),
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
            unlinkDemandForTransferOrder: jest
              .fn()
              .mockResolvedValue(undefined),
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
        {
          provide: ProjectsInventoryService,
          useValue: mockProjectsInventoryService,
        },
      ],
    }).compile();

    stateService = module.get<TransfersStateService>(TransfersStateService);
    coreService = module.get<TransfersCoreService>(TransfersCoreService);
    writeService = module.get<TransfersWriteService>(TransfersWriteService);
    inventoryMovementService = module.get<InventoryMovementService>(
      InventoryMovementService,
    );
  });

  describe('Multi-Shipment Dispatch, Sequential Receiving & Putaway', () => {
    it('should process split shipments, partial receives, and multi-batch putaways cleanly', async () => {
      // 1. Create Transfer Order for 10 units of A and 6 units of B
      const { transferOrderId } = await writeService.create(
        {
          sourceLocationId: LOCATION_SRC_ID,
          destinationLocationId: LOCATION_DST_ID,
          lines: [
            { productId: PROD_A_ID, quantity: '10' },
            { productId: PROD_B_ID, quantity: '6' },
          ],
        },
        'admin',
      );

      const toLines = await pg.db
        .select()
        .from(transferOrderLines)
        .where(eq(transferOrderLines.transferOrderId, transferOrderId));
      const lineA = toLines.find((l) => l.productId === PROD_A_ID)!;
      const lineB = toLines.find((l) => l.productId === PROD_B_ID)!;

      // 2. First Pick: 4 units of A, 3 units of B -> moves to SHIPPING bin
      await stateService.pickLine(
        transferOrderId,
        lineA.transferOrderLineId,
        BIN_SRC_STORAGE_A,
        4,
        'picker-1',
      );
      await stateService.pickLine(
        transferOrderId,
        lineB.transferOrderLineId,
        BIN_SRC_STORAGE_B,
        3,
        'picker-1',
      );

      // Verify stock in SHIPPING bin
      const contentsAfterPick1 = await pg.db.select().from(binContents);
      const shippingA1 = contentsAfterPick1.find(
        (c) => c.binId === binSrcShipping && c.productId === PROD_A_ID,
      );
      expect(shippingA1).toBeDefined();
      expect(parseFloat(shippingA1!.actualQuantity)).toBe(4);

      // 3. Dispatch Shipment 1 (4 of A, 3 of B)
      const shipment1 = await stateService.createShipment(
        transferOrderId,
        {
          lines: [
            {
              salesOrderLineId: lineA.transferOrderLineId,
              quantityShipped: '4',
            },
            {
              salesOrderLineId: lineB.transferOrderLineId,
              quantityShipped: '3',
            },
          ],
        },
        'shipper-1',
      );
      expect(shipment1.shipmentNumber).toMatch(/^TSH-/);

      // Verify state is PICKING
      const [orderAfterShip1] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));
      expect(orderAfterShip1.stateCode).toBe(TRANSFER_ORDER_STATE.PICKING);

      // Verify INTRA_TRANSIT has 4 of A and 3 of B
      const contentsAfterShip1 = await pg.db.select().from(binContents);
      const transitA1 = contentsAfterShip1.find(
        (c) => c.binId === binSrcTransit && c.productId === PROD_A_ID,
      );
      expect(transitA1).toBeDefined();
      expect(parseFloat(transitA1!.actualQuantity)).toBe(4);

      // 4. Second Pick: Remaining 6 of A, 3 of B -> moves to SHIPPING bin
      await stateService.pickLine(
        transferOrderId,
        lineA.transferOrderLineId,
        BIN_SRC_STORAGE_A,
        6,
        'picker-2',
      );
      await stateService.pickLine(
        transferOrderId,
        lineB.transferOrderLineId,
        BIN_SRC_STORAGE_B,
        3,
        'picker-2',
      );

      // 5. Dispatch Shipment 2 (6 of A, 3 of B)
      const shipment2 = await stateService.createShipment(
        transferOrderId,
        {
          lines: [
            {
              salesOrderLineId: lineA.transferOrderLineId,
              quantityShipped: '6',
            },
            {
              salesOrderLineId: lineB.transferOrderLineId,
              quantityShipped: '3',
            },
          ],
        },
        'shipper-2',
      );
      expect(shipment2.shipmentNumber).toMatch(/^TSH-/);

      // Verify state transitioned to SHIPPED
      const [orderAfterShip2] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));
      expect(orderAfterShip2.stateCode).toBe(TRANSFER_ORDER_STATE.SHIPPED);

      // Verify INTRA_TRANSIT now has 10 of A and 6 of B
      const contentsAfterShip2 = await pg.db.select().from(binContents);
      const transitA2 = contentsAfterShip2.find(
        (c) => c.binId === binSrcTransit && c.productId === PROD_A_ID,
      );
      expect(transitA2).toBeDefined();
      expect(parseFloat(transitA2!.actualQuantity)).toBe(10);

      // 6. Receive Shipment 1 (4 of A, 3 of B) at Destination
      const recv1 = await stateService.receiveTransferOrder(
        transferOrderId,
        [
          {
            transferOrderLineId: lineA.transferOrderLineId,
            quantityReceived: '4',
          },
          {
            transferOrderLineId: lineB.transferOrderLineId,
            quantityReceived: '3',
          },
        ],
        'receiver-1',
      );
      expect(recv1.receiptNumber).toMatch(/^TRC-/);

      // Verify state is PARTIALLY_RECEIVED
      const [orderAfterRecv1] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));
      expect(orderAfterRecv1.stateCode).toBe(
        TRANSFER_ORDER_STATE.PARTIALLY_RECEIVED,
      );

      // Verify Receipt 1 created receipt lines in PENDING_PUTAWAY
      const receipt1Lines = await pg.db
        .select()
        .from(transferOrderReceiptLines)
        .where(eq(transferOrderReceiptLines.receiptId, recv1.receiptId));
      expect(receipt1Lines).toHaveLength(2);
      expect(
        receipt1Lines.every(
          (r) => r.putawayStatus === PUTAWAY_STATUS.PENDING_PUTAWAY,
        ),
      ).toBe(true);

      // 7. Putaway Receipt 1 into Destination Storage Bins
      const r1LineA = receipt1Lines.find((r) => r.productId === PROD_A_ID)!;
      const r1LineB = receipt1Lines.find((r) => r.productId === PROD_B_ID)!;

      await inventoryMovementService.putaway(
        {
          putaways: [
            {
              sourceType: 'transfer_receipt',
              lineId: r1LineA.receiptLineId,
              destinationBinId: BIN_DST_STORAGE_A,
              quantity: '4',
            },
            {
              sourceType: 'transfer_receipt',
              lineId: r1LineB.receiptLineId,
              destinationBinId: BIN_DST_STORAGE_B,
              quantity: '3',
            },
          ],
        },
        'putaway-user-1',
      );

      // Verify Receipt 1 lines are COMPLETED
      const [r1LineAAfter] = await pg.db
        .select()
        .from(transferOrderReceiptLines)
        .where(
          eq(transferOrderReceiptLines.receiptLineId, r1LineA.receiptLineId),
        );
      expect(r1LineAAfter.putawayStatus).toBe(PUTAWAY_STATUS.COMPLETED);

      // 8. Receive Shipment 2 (6 of A, 3 of B) at Destination
      const recv2 = await stateService.receiveTransferOrder(
        transferOrderId,
        [
          {
            transferOrderLineId: lineA.transferOrderLineId,
            quantityReceived: '6',
          },
          {
            transferOrderLineId: lineB.transferOrderLineId,
            quantityReceived: '3',
          },
        ],
        'receiver-2',
      );

      // Verify state is now RECEIVED
      const [orderAfterRecv2] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));
      expect(orderAfterRecv2.stateCode).toBe(TRANSFER_ORDER_STATE.RECEIVED);

      // 9. Putaway Receipt 2 into Destination Storage Bins
      const receipt2Lines = await pg.db
        .select()
        .from(transferOrderReceiptLines)
        .where(eq(transferOrderReceiptLines.receiptId, recv2.receiptId));
      expect(receipt2Lines).toHaveLength(2);

      const r2LineA = receipt2Lines.find((r) => r.productId === PROD_A_ID)!;
      const r2LineB = receipt2Lines.find((r) => r.productId === PROD_B_ID)!;

      await inventoryMovementService.putaway(
        {
          putaways: [
            {
              sourceType: 'transfer_receipt',
              lineId: r2LineA.receiptLineId,
              destinationBinId: BIN_DST_STORAGE_A,
              quantity: '6',
            },
            {
              sourceType: 'transfer_receipt',
              lineId: r2LineB.receiptLineId,
              destinationBinId: BIN_DST_STORAGE_B,
              quantity: '3',
            },
          ],
        },
        'putaway-user-2',
      );

      // 10. Audit Final Stock Balances Across All Bins
      const finalContents = await pg.db.select().from(binContents);

      // Source storage: 100 - 10 = 90 (A), 50 - 6 = 44 (B)
      const srcBinA = finalContents.find(
        (c) => c.binId === BIN_SRC_STORAGE_A && c.productId === PROD_A_ID,
      );
      expect(srcBinA).toBeDefined();
      expect(parseFloat(srcBinA!.actualQuantity)).toBe(90);

      const srcBinB = finalContents.find(
        (c) => c.binId === BIN_SRC_STORAGE_B && c.productId === PROD_B_ID,
      );
      expect(srcBinB).toBeDefined();
      expect(parseFloat(srcBinB!.actualQuantity)).toBe(44);

      // Transit: 0 (A), 0 (B) (deleted or 0)
      const transitEndA = finalContents.find(
        (c) => c.binId === binSrcTransit && c.productId === PROD_A_ID,
      );
      expect(transitEndA ? parseFloat(transitEndA.actualQuantity) : 0).toBe(0);

      // Destination receiving: 0 (A), 0 (B) (deleted or 0)
      const recvEndA = finalContents.find(
        (c) => c.binId === binDstReceiving && c.productId === PROD_A_ID,
      );
      expect(recvEndA ? parseFloat(recvEndA.actualQuantity) : 0).toBe(0);

      // Destination storage: 10 (A), 6 (B)
      const dstBinA = finalContents.find(
        (c) => c.binId === BIN_DST_STORAGE_A && c.productId === PROD_A_ID,
      );
      expect(dstBinA).toBeDefined();
      expect(parseFloat(dstBinA!.actualQuantity)).toBe(10);

      const dstBinB = finalContents.find(
        (c) => c.binId === BIN_DST_STORAGE_B && c.productId === PROD_B_ID,
      );
      expect(dstBinB).toBeDefined();
      expect(parseFloat(dstBinB!.actualQuantity)).toBe(6);
    });
  });

  describe('Split Shipment Cancellation & Partial Reversal', () => {
    it('should safely reverse the second shipment and allow receiving the first shipment', async () => {
      const { transferOrderId } = await writeService.create(
        {
          sourceLocationId: LOCATION_SRC_ID,
          destinationLocationId: LOCATION_DST_ID,
          lines: [{ productId: PROD_A_ID, quantity: '10' }],
        },
        'admin',
      );

      const [line] = await pg.db
        .select()
        .from(transferOrderLines)
        .where(eq(transferOrderLines.transferOrderId, transferOrderId));

      // Pick full 10 units
      await stateService.pickLine(
        transferOrderId,
        line.transferOrderLineId,
        BIN_SRC_STORAGE_A,
        10,
        'picker-1',
      );

      // Dispatch Shipment 1 (4 units) -> PARTIALLY_SHIPPED
      const shipment1 = await stateService.createShipment(
        transferOrderId,
        {
          lines: [
            {
              salesOrderLineId: line.transferOrderLineId,
              quantityShipped: '4',
            },
          ],
        },
        'shipper',
      );

      // Dispatch Shipment 2 (6 units) -> SHIPPED
      const shipment2 = await stateService.createShipment(
        transferOrderId,
        {
          lines: [
            {
              salesOrderLineId: line.transferOrderLineId,
              quantityShipped: '6',
            },
          ],
        },
        'shipper',
      );

      const [orderShipped] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));
      expect(orderShipped.stateCode).toBe(TRANSFER_ORDER_STATE.SHIPPED);

      // Cancel Shipment 2 -> reverses 6 units from INTRA_TRANSIT to SHIPPING
      await stateService.cancelShipment(
        transferOrderId,
        shipment2.shipmentId,
        'shipper',
      );

      // Verify order state regresses to PICKING
      const [orderAfterCancel] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));
      expect(orderAfterCancel.stateCode).toBe(TRANSFER_ORDER_STATE.PICKING);

      // Verify line quantityShipped rolled back from 10 to 4
      const [lineAfterCancel] = await pg.db
        .select()
        .from(transferOrderLines)
        .where(
          eq(transferOrderLines.transferOrderLineId, line.transferOrderLineId),
        );
      expect(parseFloat(lineAfterCancel.quantityShipped || '0')).toBe(4);

      // Cancel remaining 6 picked units -> unpicks back to BIN_SRC_STORAGE_A
      const picks = await pg.db
        .select()
        .from(transferOrderPicks)
        .where(
          and(
            eq(transferOrderPicks.transferOrderId, transferOrderId),
            eq(transferOrderPicks.stateCode, 'picked'),
          ),
        );
      expect(picks).toHaveLength(1);
      expect(parseFloat(picks[0].quantity)).toBe(6);

      await stateService.cancelPick(
        transferOrderId,
        picks[0].pickId,
        'picker-1',
      );

      // Verify Source Storage A is back to 96 (100 - 4 shipped)
      const allContentsAfterUnpick = await pg.db.select().from(binContents);
      const srcStorageAfter = allContentsAfterUnpick.find(
        (c) => c.binId === BIN_SRC_STORAGE_A && c.productId === PROD_A_ID,
      );
      expect(srcStorageAfter).toBeDefined();
      expect(parseFloat(srcStorageAfter!.actualQuantity)).toBe(96);

      // Receive Shipment 1 (4 units) -> returns to PICKING because 6 units remain unfulfilled
      await stateService.receiveTransferOrder(
        transferOrderId,
        [
          {
            transferOrderLineId: line.transferOrderLineId,
            quantityReceived: '4',
          },
        ],
        'receiver',
      );

      const [orderAfterRecv1] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));
      expect(orderAfterRecv1.stateCode).toBe(TRANSFER_ORDER_STATE.PICKING);

      // Re-pick remaining 6 units
      await stateService.pickLine(
        transferOrderId,
        line.transferOrderLineId,
        BIN_SRC_STORAGE_A,
        6,
        'picker-2',
      );

      // Re-ship remaining 6 units
      await stateService.createShipment(
        transferOrderId,
        {
          lines: [
            {
              salesOrderLineId: line.transferOrderLineId,
              quantityShipped: '6',
            },
          ],
        },
        'shipper-2',
      );

      // Receive final 6 units -> now all 10/10 units are received, transitions to RECEIVED
      await stateService.receiveTransferOrder(
        transferOrderId,
        [
          {
            transferOrderLineId: line.transferOrderLineId,
            quantityReceived: '6',
          },
        ],
        'receiver-2',
      );

      const [orderFinal] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));
      expect(orderFinal.stateCode).toBe(TRANSFER_ORDER_STATE.RECEIVED);
    });
  });

  describe('Partial Fulfillment with Interleaved Picking, Shipping, and Receiving Lifecycle', () => {
    it('should maintain picking state, queue visibility, and allow subsequent fulfillment when partial shipments are received', async () => {
      // 1. Create Transfer Order for 20 units of A and 10 units of B
      const { transferOrderId } = await writeService.create(
        {
          sourceLocationId: LOCATION_SRC_ID,
          destinationLocationId: LOCATION_DST_ID,
          lines: [
            { productId: PROD_A_ID, quantity: '20' },
            { productId: PROD_B_ID, quantity: '10' },
          ],
        },
        'admin',
      );

      const toLines = await pg.db
        .select()
        .from(transferOrderLines)
        .where(eq(transferOrderLines.transferOrderId, transferOrderId));
      const lineA = toLines.find((l) => l.productId === PROD_A_ID)!;
      const lineB = toLines.find((l) => l.productId === PROD_B_ID)!;

      // Unfulfilled order has NO pending receipts
      const q0 = await coreService.findAll({
        hasPendingReceipt: true,
        destinationLocationId: LOCATION_DST_ID,
      });
      expect(q0.data.map((d) => d.transferOrderId)).not.toContain(
        transferOrderId,
      );

      // 2. First Pick & Partial Dispatch: 5 of A, 3 of B
      await stateService.pickLine(
        transferOrderId,
        lineA.transferOrderLineId,
        BIN_SRC_STORAGE_A,
        5,
        'picker',
      );
      await stateService.pickLine(
        transferOrderId,
        lineB.transferOrderLineId,
        BIN_SRC_STORAGE_B,
        3,
        'picker',
      );

      const shipment1 = await stateService.createShipment(
        transferOrderId,
        {
          lines: [
            {
              salesOrderLineId: lineA.transferOrderLineId,
              quantityShipped: '5',
            },
            {
              salesOrderLineId: lineB.transferOrderLineId,
              quantityShipped: '3',
            },
          ],
        },
        'shipper',
      );

      // Order remains in PICKING because 15 of A and 7 of B remain unshipped
      const [orderAfterShip1] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));
      expect(orderAfterShip1.stateCode).toBe(TRANSFER_ORDER_STATE.PICKING);

      // Incoming transfers queue DOES show the order (goods in transit)
      const q1 = await coreService.findAll({
        hasPendingReceipt: true,
        destinationLocationId: LOCATION_DST_ID,
      });
      expect(q1.data.map((d) => d.transferOrderId)).toContain(transferOrderId);

      // 3. Receive Shipment 1 (5 of A, 3 of B) at Destination
      await stateService.receiveTransferOrder(
        transferOrderId,
        [
          {
            transferOrderLineId: lineA.transferOrderLineId,
            quantityReceived: '5',
          },
          {
            transferOrderLineId: lineB.transferOrderLineId,
            quantityReceived: '3',
          },
        ],
        'receiver',
      );

      // CRITICAL CHECK: Order state returns to PICKING (NOT RECEIVED!), because 15 of A and 7 of B are still unfulfilled!
      const [orderAfterRecv1] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));
      expect(orderAfterRecv1.stateCode).toBe(TRANSFER_ORDER_STATE.PICKING);

      // All in-transit goods for this order are received, so it leaves the incoming queue
      const q2 = await coreService.findAll({
        hasPendingReceipt: true,
        destinationLocationId: LOCATION_DST_ID,
      });
      expect(q2.data.map((d) => d.transferOrderId)).not.toContain(
        transferOrderId,
      );

      // 4. Second Pick & Dispatch: 10 of A, 5 of B
      await stateService.pickLine(
        transferOrderId,
        lineA.transferOrderLineId,
        BIN_SRC_STORAGE_A,
        10,
        'picker',
      );
      await stateService.pickLine(
        transferOrderId,
        lineB.transferOrderLineId,
        BIN_SRC_STORAGE_B,
        5,
        'picker',
      );

      await stateService.createShipment(
        transferOrderId,
        {
          lines: [
            {
              salesOrderLineId: lineA.transferOrderLineId,
              quantityShipped: '10',
            },
            {
              salesOrderLineId: lineB.transferOrderLineId,
              quantityShipped: '5',
            },
          ],
        },
        'shipper',
      );

      // Order still in PICKING (total shipped: 15/20 of A, 8/10 of B)
      const [orderAfterShip2] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));
      expect(orderAfterShip2.stateCode).toBe(TRANSFER_ORDER_STATE.PICKING);

      // Incoming queue shows order again
      const q3 = await coreService.findAll({
        hasPendingReceipt: true,
        destinationLocationId: LOCATION_DST_ID,
      });
      expect(q3.data.map((d) => d.transferOrderId)).toContain(transferOrderId);

      // 5. Partial receipt of Shipment 2: Receive only 4 of A, 2 of B (6 of A, 3 of B still in transit)
      await stateService.receiveTransferOrder(
        transferOrderId,
        [
          {
            transferOrderLineId: lineA.transferOrderLineId,
            quantityReceived: '4',
          },
          {
            transferOrderLineId: lineB.transferOrderLineId,
            quantityReceived: '2',
          },
        ],
        'receiver',
      );

      // State is PARTIALLY_RECEIVED because shipped items are still in transit
      const [orderAfterPartialRecv2] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));
      expect(orderAfterPartialRecv2.stateCode).toBe(
        TRANSFER_ORDER_STATE.PARTIALLY_RECEIVED,
      );

      // Still visible in queue
      const q4 = await coreService.findAll({
        hasPendingReceipt: true,
        destinationLocationId: LOCATION_DST_ID,
      });
      expect(q4.data.map((d) => d.transferOrderId)).toContain(transferOrderId);

      // Receive remaining 6 of A and 3 of B from Shipment 2
      await stateService.receiveTransferOrder(
        transferOrderId,
        [
          {
            transferOrderLineId: lineA.transferOrderLineId,
            quantityReceived: '6',
          },
          {
            transferOrderLineId: lineB.transferOrderLineId,
            quantityReceived: '3',
          },
        ],
        'receiver',
      );

      // All shipped items received! State returns to PICKING (remaining to pick: 5 of A, 2 of B)
      const [orderAfterRecv2Done] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));
      expect(orderAfterRecv2Done.stateCode).toBe(TRANSFER_ORDER_STATE.PICKING);

      // 6. Final Pick & Dispatch: 5 of A, 2 of B (100% of order shipped)
      await stateService.pickLine(
        transferOrderId,
        lineA.transferOrderLineId,
        BIN_SRC_STORAGE_A,
        5,
        'picker',
      );
      await stateService.pickLine(
        transferOrderId,
        lineB.transferOrderLineId,
        BIN_SRC_STORAGE_B,
        2,
        'picker',
      );

      await stateService.createShipment(
        transferOrderId,
        {
          lines: [
            {
              salesOrderLineId: lineA.transferOrderLineId,
              quantityShipped: '5',
            },
            {
              salesOrderLineId: lineB.transferOrderLineId,
              quantityShipped: '2',
            },
          ],
        },
        'shipper',
      );

      // Full order is shipped! State transitions to SHIPPED
      const [orderAfterFinalShip] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));
      expect(orderAfterFinalShip.stateCode).toBe(TRANSFER_ORDER_STATE.SHIPPED);

      // 7. Receive final 5 of A and 2 of B
      await stateService.receiveTransferOrder(
        transferOrderId,
        [
          {
            transferOrderLineId: lineA.transferOrderLineId,
            quantityReceived: '5',
          },
          {
            transferOrderLineId: lineB.transferOrderLineId,
            quantityReceived: '2',
          },
        ],
        'receiver',
      );

      // 100% of requested order is received! State transitions to RECEIVED
      const [orderFullyReceived] = await pg.db
        .select()
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));
      expect(orderFullyReceived.stateCode).toBe(TRANSFER_ORDER_STATE.RECEIVED);

      // Leaves the incoming queue
      const qFinal = await coreService.findAll({
        hasPendingReceipt: true,
        destinationLocationId: LOCATION_DST_ID,
      });
      expect(qFinal.data.map((d) => d.transferOrderId)).not.toContain(
        transferOrderId,
      );
    });
  });

  describe('Project Return Multi-Shipment with Cumulative WIP Credits', () => {
    it('should issue incremental WIP credits across sequential project return receipts', async () => {
      const CUST_ID = '00000000-0000-4000-8000-000000000099';
      const PROJECT_ID = '00000000-0000-4000-8000-000000000098';
      const STAGING_BIN_ID = '00000000-0000-4000-8000-000000000097';

      await pg.db.insert(customers).values({
        customerId: CUST_ID,
        customerNumber: 'CUST-PRJ',
        currencyCode: 'AUD',
        stateCode: CUSTOMER_STATE.ACTIVE,
        source: 'app',
        createdBy: 'system',
      });

      await pg.db.insert(bins).values({
        binId: STAGING_BIN_ID,
        binNumber: 'STG-PRJ-01',
        zoneId: ZONE_SRC_ID,
        binType: 'staging',
        source: 'app',
        createdBy: 'system',
        isUnavailable: false,
        isBonded: false,
      });

      await pg.db.insert(projects).values({
        projectId: PROJECT_ID,
        projectNumber: 'PRJ-MULTI-RET',
        name: 'Multi Return Project',
        customerId: CUST_ID,
        stateCode: PROJECT_STATE.ACTIVE,
        billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
        currencyCode: 'AUD',
        stagingBinId: STAGING_BIN_ID,
        createdBy: 'system',
      });

      await pg.db.insert(binContents).values({
        binId: STAGING_BIN_ID,
        productId: PROD_A_ID,
        actualQuantity: '20',
      });

      // Create Project Return TO for 8 units of PROD-A
      const { transferOrderId } = await writeService.create(
        {
          sourceLocationId: LOCATION_SRC_ID,
          destinationLocationId: LOCATION_DST_ID,
          projectId: PROJECT_ID,
          isProjectReturn: true,
          lines: [{ productId: PROD_A_ID, quantity: '8' }],
        },
        'admin',
      );

      const [line] = await pg.db
        .select()
        .from(transferOrderLines)
        .where(eq(transferOrderLines.transferOrderId, transferOrderId));

      // Pick 3 units from project staging bin
      await stateService.pickLine(
        transferOrderId,
        line.transferOrderLineId,
        STAGING_BIN_ID,
        3,
        'picker',
      );

      // Dispatch Shipment 1 (3 units)
      await stateService.createShipment(
        transferOrderId,
        {
          lines: [
            {
              salesOrderLineId: line.transferOrderLineId,
              quantityShipped: '3',
            },
          ],
        },
        'shipper',
      );

      // Pick remaining 5 units from project staging bin
      await stateService.pickLine(
        transferOrderId,
        line.transferOrderLineId,
        STAGING_BIN_ID,
        5,
        'picker',
      );

      // Dispatch Shipment 2 (5 units)
      await stateService.createShipment(
        transferOrderId,
        {
          lines: [
            {
              salesOrderLineId: line.transferOrderLineId,
              quantityShipped: '5',
            },
          ],
        },
        'shipper',
      );

      // Receive Shipment 1 (3 units)
      const recv1 = await stateService.receiveTransferOrder(
        transferOrderId,
        [
          {
            transferOrderLineId: line.transferOrderLineId,
            quantityReceived: '3',
          },
        ],
        'receiver',
      );

      const [r1Line] = await pg.db
        .select()
        .from(transferOrderReceiptLines)
        .where(eq(transferOrderReceiptLines.receiptId, recv1.receiptId));

      // Putaway Shipment 1 -> verify first WIP credit call (quantity: 3)
      await inventoryMovementService.putaway(
        {
          putaways: [
            {
              sourceType: 'transfer_receipt',
              lineId: r1Line.receiptLineId,
              destinationBinId: BIN_DST_STORAGE_A,
              quantity: '3',
            },
          ],
        },
        'putaway-user',
      );

      expect(
        mockProjectsInventoryService.recordProjectReturnCredit,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockProjectsInventoryService.recordProjectReturnCredit,
      ).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          projectId: PROJECT_ID,
          productId: PROD_A_ID,
          quantity: 3,
        }),
      );

      // Receive Shipment 2 (5 units)
      const recv2 = await stateService.receiveTransferOrder(
        transferOrderId,
        [
          {
            transferOrderLineId: line.transferOrderLineId,
            quantityReceived: '5',
          },
        ],
        'receiver',
      );

      const [r2Line] = await pg.db
        .select()
        .from(transferOrderReceiptLines)
        .where(eq(transferOrderReceiptLines.receiptId, recv2.receiptId));

      // Putaway Shipment 2 -> verify second WIP credit call (quantity: 5)
      await inventoryMovementService.putaway(
        {
          putaways: [
            {
              sourceType: 'transfer_receipt',
              lineId: r2Line.receiptLineId,
              destinationBinId: BIN_DST_STORAGE_A,
              quantity: '5',
            },
          ],
        },
        'putaway-user',
      );

      expect(
        mockProjectsInventoryService.recordProjectReturnCredit,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockProjectsInventoryService.recordProjectReturnCredit,
      ).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          projectId: PROJECT_ID,
          productId: PROD_A_ID,
          quantity: 5,
        }),
      );
    });

    it('should trigger recordProjectStagingCharge on each putaway for inbound project transfer orders', async () => {
      const INBOUND_PRJ_ID = '00000000-0000-4000-8000-000000000199';
      const INBOUND_CUST_ID = '00000000-0000-4000-8000-000000000198';

      // Create Customer
      await pg.db.insert(customers).values({
        customerId: INBOUND_CUST_ID,
        customerNumber: 'CUST-INBOUND',
        currencyCode: 'AUD',
        stateCode: CUSTOMER_STATE.ACTIVE,
        source: 'app',
        createdBy: 'system',
      });

      // Create Project
      await pg.db.insert(projects).values({
        projectId: INBOUND_PRJ_ID,
        projectNumber: 'PRJ-1002',
        name: 'Inbound Staging Project',
        customerId: INBOUND_CUST_ID,
        stateCode: PROJECT_STATE.ACTIVE,
        stage: 'Execution',
        billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
        stagingLocationId: LOCATION_DST_ID,
        stagingBinId: BIN_DST_STORAGE_A,
        currencyCode: 'AUD',
        metadata: {},
        createdBy: 'system',
      });

      // Stock up source bin
      await inventoryMovementService['recordInventoryMovement'](pg.db, {
        entryNumber: 'INIT-INBOUND-STG',
        sourceType: 'MANUAL',
        sourceId: '00000000-0000-4000-8000-000000000099',
        memo: 'Init source stock',
        userId: 'admin',
        lines: [
          {
            productId: PROD_A_ID,
            binId: BIN_SRC_STORAGE_A,
            quantity: 10,
            uomCode: 'EA',
          },
        ],
      });

      // Create Inbound Project Transfer Order (8 units)
      const { transferOrderId } = await writeService.create(
        {
          sourceLocationId: LOCATION_SRC_ID,
          destinationLocationId: LOCATION_DST_ID,
          projectId: INBOUND_PRJ_ID,
          isProjectReturn: false,
          lines: [
            {
              productId: PROD_A_ID,
              quantity: '8',
            },
          ],
        },
        'user',
      );

      const [line] = await pg.db
        .select()
        .from(transferOrderLines)
        .where(eq(transferOrderLines.transferOrderId, transferOrderId));

      // Pick 8 units from source bin
      await stateService.pickLine(
        transferOrderId,
        line.transferOrderLineId,
        BIN_SRC_STORAGE_A,
        8,
        'picker',
      );

      // Ship 8 units
      await stateService.createShipment(
        transferOrderId,
        {
          lines: [
            {
              salesOrderLineId: line.transferOrderLineId,
              quantityShipped: '8',
            },
          ],
        },
        'shipper',
      );

      // Receive 8 units
      const recv = await stateService.receiveTransferOrder(
        transferOrderId,
        [
          {
            transferOrderLineId: line.transferOrderLineId,
            quantityReceived: '8',
          },
        ],
        'receiver',
      );

      const [rLine] = await pg.db
        .select()
        .from(transferOrderReceiptLines)
        .where(eq(transferOrderReceiptLines.receiptId, recv.receiptId));

      // Putaway into project staging bin -> triggers recordProjectStagingCharge
      await inventoryMovementService.putaway(
        {
          putaways: [
            {
              sourceType: 'transfer_receipt',
              lineId: rLine.receiptLineId,
              destinationBinId: BIN_DST_STORAGE_A,
              quantity: '8',
            },
          ],
        },
        'putaway-user',
      );

      expect(
        mockProjectsInventoryService.recordProjectStagingCharge,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockProjectsInventoryService.recordProjectStagingCharge,
      ).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          projectId: INBOUND_PRJ_ID,
          productId: PROD_A_ID,
          quantity: 8,
          actor: 'putaway-user',
        }),
      );
    });
  });

  describe('Multi-Shipment Guardrail Validations', () => {
    it('should reject receiving more than quantityShipped on split orders', async () => {
      const { transferOrderId } = await writeService.create(
        {
          sourceLocationId: LOCATION_SRC_ID,
          destinationLocationId: LOCATION_DST_ID,
          lines: [{ productId: PROD_A_ID, quantity: '10' }],
        },
        'admin',
      );

      const [line] = await pg.db
        .select()
        .from(transferOrderLines)
        .where(eq(transferOrderLines.transferOrderId, transferOrderId));

      await stateService.pickLine(
        transferOrderId,
        line.transferOrderLineId,
        BIN_SRC_STORAGE_A,
        4,
        'picker',
      );

      await stateService.createShipment(
        transferOrderId,
        {
          lines: [
            {
              salesOrderLineId: line.transferOrderLineId,
              quantityShipped: '4',
            },
          ],
        },
        'shipper',
      );

      // Attempting to receive 5 when only 4 were shipped
      await expect(
        stateService.receiveTransferOrder(
          transferOrderId,
          [
            {
              transferOrderLineId: line.transferOrderLineId,
              quantityReceived: '5',
            },
          ],
          'receiver',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject shipping more than quantityPicked on split orders', async () => {
      const { transferOrderId } = await writeService.create(
        {
          sourceLocationId: LOCATION_SRC_ID,
          destinationLocationId: LOCATION_DST_ID,
          lines: [{ productId: PROD_A_ID, quantity: '10' }],
        },
        'admin',
      );

      const [line] = await pg.db
        .select()
        .from(transferOrderLines)
        .where(eq(transferOrderLines.transferOrderId, transferOrderId));

      await stateService.pickLine(
        transferOrderId,
        line.transferOrderLineId,
        BIN_SRC_STORAGE_A,
        4,
        'picker',
      );

      // Attempting to ship 5 when only 4 were picked
      await expect(
        stateService.createShipment(
          transferOrderId,
          {
            lines: [
              {
                salesOrderLineId: line.transferOrderLineId,
                quantityShipped: '5',
              },
            ],
          },
          'shipper',
        ),
      ).rejects.toThrow('Cannot ship more than picked');
    });
  });
});

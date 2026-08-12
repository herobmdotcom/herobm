import { Test, TestingModule } from '@nestjs/testing';
import { WorkOrdersService } from './work-orders.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { InventoryMovementService } from '../inventory/inventory-movement.service';
import { UomService } from '../inventory/uom.service';
import { AppConfigService } from '../settings/app-config.service';
import { GlService } from '../gl/gl.service';
import {
  products,
  locations,
  zones,
  bins,
  productComponents,
  workOrders,
  workOrderComponents,
  workOrderPicks,
  uomDictionary,
} from '@herobm/db-schema';
import { PRODUCT_STATE, WORK_ORDER_STATE } from '@herobm/shared';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';

describe('WorkOrdersService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: WorkOrdersService;

  let testProductId: string;
  let testCompProductId1: string;
  let testCompProductId2: string;
  let testLocationId: string;
  let testZoneId: string;
  let testBinId: string;

  beforeEach(async () => {
    await pg.db.delete(workOrderPicks);
    await pg.db.delete(workOrderComponents);
    await pg.db.delete(workOrders);
    await pg.db.delete(productComponents);
    await pg.db.delete(bins);
    await pg.db.delete(zones);
    await pg.db.delete(locations);
    await pg.db.delete(products);

    // Seed required UOM
    await pg.db
      .insert(uomDictionary)
      .values({
        uomCode: 'EA',
        description: 'Each',
      })
      .onConflictDoNothing();

    // Create test products
    const [prod] = await pg.db
      .insert(products)
      .values({
        productNumber: 'PROD-KIT-100',
        name: 'Assembled Widget Kit',
        structureType: 'kit',
        productType: 'inventory',
        stateCode: PRODUCT_STATE.ACTIVE,
        baseUom: 'EA',
        source: 'manual',
      })
      .returning();
    testProductId = prod.productId;

    const [comp1] = await pg.db
      .insert(products)
      .values({
        productNumber: 'COMP-RAW-001',
        name: 'Raw Metal Bolt',
        structureType: 'standard',
        productType: 'inventory',
        stateCode: PRODUCT_STATE.ACTIVE,
        baseUom: 'EA',
        source: 'manual',
      })
      .returning();
    testCompProductId1 = comp1.productId;

    const [comp2] = await pg.db
      .insert(products)
      .values({
        productNumber: 'COMP-RAW-002',
        name: 'Steel Bracket',
        structureType: 'standard',
        productType: 'inventory',
        stateCode: PRODUCT_STATE.ACTIVE,
        baseUom: 'EA',
        source: 'manual',
      })
      .returning();
    testCompProductId2 = comp2.productId;

    // Create BOM mapping
    await pg.db.insert(productComponents).values([
      {
        parentProductId: testProductId,
        childProductId: testCompProductId1,
        parentQuantity: '1',
        quantity: '4',
        sequenceNumber: 1,
        fractionalBehavior: 'allow_fractional',
      },
      {
        parentProductId: testProductId,
        childProductId: testCompProductId2,
        parentQuantity: '1',
        quantity: '2',
        sequenceNumber: 2,
        fractionalBehavior: 'allow_fractional',
      },
    ]);

    // Create test Location & Bin
    const [loc] = await pg.db
      .insert(locations)
      .values({
        code: 'MAIN-WH',
        name: 'Main Assembly Warehouse',
        source: 'manual',
      })
      .returning();
    testLocationId = loc.locationId;

    const [zone] = await pg.db
      .insert(zones)
      .values({
        locationId: testLocationId,
        code: 'WIP',
        name: 'Work In Progress Zone',
        source: 'manual',
      })
      .returning();
    testZoneId = zone.zoneId;

    const [bin] = await pg.db
      .insert(bins)
      .values({
        zoneId: testZoneId,
        binNumber: 'BIN-WIP-A1',
        binType: 'pick',
        source: 'manual',
      })
      .returning();
    testBinId = bin.binId;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkOrdersService,
        InventoryMovementService,
        UomService,
        {
          provide: AppConfigService,
          useValue: {
            defaultFulfillmentLocationId: jest
              .fn()
              .mockReturnValue(testLocationId),
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
          provide: DRIZZLE,
          useValue: pg.db,
        },
      ],
    }).compile();

    service = module.get<WorkOrdersService>(WorkOrdersService);
  });

  describe('findAll', () => {
    it('should return empty list when no work orders exist', async () => {
      const result = await service.findAll();
      expect(result).toEqual([]);
    });

    it('should return all created work orders', async () => {
      await pg.db.insert(workOrders).values({
        orderNumber: 'WO-20260811-0001',
        productId: testProductId,
        targetQuantity: '10',
        completedQuantity: '0',
        locationId: testLocationId,
        stateCode: WORK_ORDER_STATE.DRAFT,
      });

      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(result[0].orderNumber).toBe('WO-20260811-0001');
      expect(result[0].productNumber).toBe('PROD-KIT-100');
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if work order does not exist', async () => {
      await expect(service.findOne(randomUUID())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return work order with component details', async () => {
      const [wo] = await pg.db
        .insert(workOrders)
        .values({
          orderNumber: 'WO-20260811-0002',
          productId: testProductId,
          targetQuantity: '5',
          completedQuantity: '0',
          locationId: testLocationId,
          wipBinId: testBinId,
          stateCode: WORK_ORDER_STATE.DRAFT,
        })
        .returning();

      await pg.db.insert(workOrderComponents).values({
        workOrderId: wo.workOrderId,
        productId: testCompProductId1,
        expectedQuantity: '20',
        unitCost: '2.50',
      });

      const result = await service.findOne(wo.workOrderId);
      expect(result.orderNumber).toBe('WO-20260811-0002');
      expect(result.components).toHaveLength(1);
      expect(result.components[0].productNumber).toBe('COMP-RAW-001');
      expect(result.components[0].expectedQuantity).toBe('20');
    });
  });

  describe('create', () => {
    it('should create a work order with explicit components', async () => {
      const dto = {
        orderNumber: 'WO-CUSTOM-001',
        productId: testProductId,
        targetQuantity: '5',
        locationId: testLocationId,
        wipBinId: testBinId,
        components: [
          {
            productId: testCompProductId1,
            expectedQuantity: '20',
            unitCost: '2.50',
          },
        ],
      };

      const result = await service.create(dto, 'admin');

      expect(result.orderNumber).toBe('WO-CUSTOM-001');
      expect(result.productName).toBe('Assembled Widget Kit');
      expect(result.locationName).toBe('Main Assembly Warehouse');
      expect(result.wipBinName).toBe('BIN-WIP-A1');
      expect(result.targetQuantity).toBe('5');
      expect(result.stateCode).toBe(WORK_ORDER_STATE.DRAFT);
      expect(result.createdBy).toBe('admin');
      expect(result.components).toHaveLength(1);
      expect(result.components[0].productId).toBe(testCompProductId1);
      expect(result.components[0].expectedQuantity).toBe('20');
      expect(result.components[0].unitCost).toBe('2.50');
    });

    it('should create a work order auto-generating WO order number and scaling BOM components', async () => {
      const dto = {
        productId: testProductId,
        targetQuantity: '3',
        locationId: testLocationId,
      };

      const result = await service.create(dto, 'worker-1');

      expect(result.orderNumber).toMatch(/^WO-\d{8}-[A-Z0-9]{4}$/);
      expect(result.targetQuantity).toBe('3');
      expect(result.createdBy).toBe('worker-1');
      expect(result.components).toHaveLength(2);

      const comp1 = result.components.find(
        (c) => c.productId === testCompProductId1,
      );
      const comp2 = result.components.find(
        (c) => c.productId === testCompProductId2,
      );

      expect(comp1?.expectedQuantity).toBe('12');
      expect(comp2?.expectedQuantity).toBe('6');
    });

    it('should throw BadRequestException if WIP bin belongs to a different location', async () => {
      const [otherLoc] = await pg.db
        .insert(locations)
        .values({
          code: 'LOC-OTHER',
          name: 'Other Location',
          source: 'manual',
        })
        .returning();

      const [otherZone] = await pg.db
        .insert(zones)
        .values({
          locationId: otherLoc.locationId,
          code: 'Z-OTHER',
          name: 'Other Zone',
          source: 'manual',
        })
        .returning();

      const [otherBin] = await pg.db
        .insert(bins)
        .values({
          zoneId: otherZone.zoneId,
          binNumber: 'BIN-OTHER-01',
          binType: 'staging',
          source: 'manual',
        })
        .returning();

      const dto = {
        productId: testProductId,
        targetQuantity: '1',
        locationId: testLocationId,
        wipBinId: otherBin.binId,
      };

      await expect(service.create(dto, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if WIP bin is unavailable', async () => {
      const [unavailBin] = await pg.db
        .insert(bins)
        .values({
          zoneId: testZoneId,
          binNumber: 'BIN-UNAVAIL-01',
          binType: 'staging',
          isUnavailable: true,
          source: 'manual',
        })
        .returning();

      const dto = {
        productId: testProductId,
        targetQuantity: '1',
        locationId: testLocationId,
        wipBinId: unavailBin.binId,
      };

      await expect(service.create(dto, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if WIP bin is a quarantine bin', async () => {
      const [quarantineBin] = await pg.db
        .insert(bins)
        .values({
          zoneId: testZoneId,
          binNumber: 'BIN-QUARANTINE-01',
          binType: 'quarantine',
          source: 'manual',
        })
        .returning();

      const dto = {
        productId: testProductId,
        targetQuantity: '1',
        locationId: testLocationId,
        wipBinId: quarantineBin.binId,
      };

      await expect(service.create(dto, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('state transitions (release, completeBuild, putawayFinishedGoods, cancel)', () => {
    it('should release a draft work order to in_progress and generate component pick tasks', async () => {
      const dto = {
        productId: testProductId,
        targetQuantity: '2',
        locationId: testLocationId,
      };
      const wo = await service.create(dto, 'user1');

      const released = await service.release(wo.workOrderId, 'user1');
      expect(released.stateCode).toBe(WORK_ORDER_STATE.IN_PROGRESS);

      const picks = await pg.db.select().from(workOrderPicks);
      expect(picks).toHaveLength(2);
      expect(picks[0].workOrderId).toBe(wo.workOrderId);
      expect(picks[0].stateCode).toBe('pending');
    });

    it('should complete production build and calculate total cost', async () => {
      const dto = {
        productId: testProductId,
        targetQuantity: '2',
        locationId: testLocationId,
        components: [
          {
            productId: testCompProductId1,
            expectedQuantity: '8',
            unitCost: '5.00',
          },
          {
            productId: testCompProductId2,
            expectedQuantity: '4',
            unitCost: '2.50',
          },
        ],
      };
      const wo = await service.create(dto, 'user1');
      await service.release(wo.workOrderId, 'user1');

      const completed = await service.completeBuild(
        wo.workOrderId,
        undefined,
        'user1',
      );
      expect(completed.stateCode).toBe(WORK_ORDER_STATE.COMPLETED);
      expect(completed.completedQuantity).toBe('2');
      expect(completed.totalCost).toBe('50.00'); // 8*5 + 4*2.5 = 50.00
    });

    it('should reject invalid state transitions', async () => {
      const dto = {
        productId: testProductId,
        targetQuantity: '1',
        locationId: testLocationId,
      };
      const wo = await service.create(dto, 'user1');

      // Cannot complete a DRAFT work order directly
      await expect(service.completeBuild(wo.workOrderId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

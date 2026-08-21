import { Test, TestingModule } from '@nestjs/testing';
import { LocationsService } from './locations.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  locations,
  zones,
  bins,
  binContents,
  inventoryLedger,
  inventoryEntries,
  productDefaultBins,
  products,
  uomDictionary,
  appSettings,
} from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import { PRODUCT_STATE } from '@herobm/shared';

describe('LocationsService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: LocationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LocationsService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<LocationsService>(LocationsService);

    // Clean data in correct dependency order
    await pg.db.delete(inventoryLedger);
    await pg.db.delete(inventoryEntries);
    await pg.db.delete(productDefaultBins);
    await pg.db.delete(binContents);
    await pg.db.delete(products);
    await pg.db.delete(bins);
    await pg.db.delete(zones);
    await pg.db.delete(appSettings);
    await pg.db.delete(locations);
    await pg.db.delete(uomDictionary);

    await pg.db.insert(uomDictionary).values({
      uomCode: 'EA',
      description: 'Each',
    });
  });

  describe('Locations', () => {
    it('should create a location', async () => {
      const dto = { code: 'L1', name: 'Location 1' };
      const result = await service.createLocation(dto, 'admin');
      expect(result.code).toBe('L1');

      const rows = await pg.db
        .select()
        .from(locations)
        .where(eq(locations.locationId, result.locationId));
      expect(rows).toHaveLength(1);
    });

    it('should update a location', async () => {
      const [loc] = await pg.db
        .insert(locations)
        .values({ code: 'L1', name: 'Old', source: 'app', createdBy: 'system' })
        .returning();
      const result = await service.updateLocation(loc.locationId, {
        name: 'New',
      });
      expect(result.name).toBe('New');
    });

    it('should prevent deleting location with non-system zones', async () => {
      const [loc] = await pg.db
        .insert(locations)
        .values({ code: 'L1', name: 'L1', source: 'app', createdBy: 'system' })
        .returning();
      await pg.db.insert(zones).values({
        locationId: loc.locationId,
        code: 'Z1',
        name: 'Z1',
        source: 'app',
        createdBy: 'system',
      });

      await expect(service.deleteLocation(loc.locationId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should prevent deleting location set as default', async () => {
      const [loc] = await pg.db
        .insert(locations)
        .values({ code: 'L1', name: 'L1', source: 'app', createdBy: 'system' })
        .returning();
      await pg.db.insert(appSettings).values({
        defaultFulfillmentLocationId: loc.locationId,
        creditLimitBehavior: 'block',
        apiRateLimit: '100',
        inventoryValuationMethod: 'fifo',
        inventoryAccountingMode: 'perpetual',
      });

      await expect(service.deleteLocation(loc.locationId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should successfully delete location with system zones and 0-quantity cache bins', async () => {
      const [loc] = await pg.db
        .insert(locations)
        .values({ code: 'L1', name: 'L1', source: 'app', createdBy: 'system' })
        .returning();
      const [zone] = await pg.db
        .select()
        .from(zones)
        .where(eq(zones.locationId, loc.locationId));
      const [bin] = await pg.db
        .select()
        .from(bins)
        .where(eq(bins.zoneId, zone.zoneId));
      const [prod] = await pg.db
        .insert(products)
        .values({
          productNumber: 'P1',
          name: 'Product 1',
          productType: 'inventory',
          structureType: 'standard',
          baseUom: 'EA',
          stateCode: PRODUCT_STATE.ACTIVE,
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      await pg.db.insert(binContents).values({
        binId: bin.binId,
        productId: prod.productId,
        actualQuantity: '0',
      });

      const res = await service.deleteLocation(loc.locationId);
      expect(res.success).toBe(true);

      const locRows = await pg.db
        .select()
        .from(locations)
        .where(eq(locations.locationId, loc.locationId));
      expect(locRows).toHaveLength(0);
    });
  });

  describe('Zones', () => {
    it('should create a zone', async () => {
      const [loc] = await pg.db
        .insert(locations)
        .values({ code: 'L1', name: 'L1', source: 'app', createdBy: 'system' })
        .returning();
      const dto = { locationId: loc.locationId, code: 'Z1', name: 'Zone 1' };
      const result = await service.createZone(dto, 'admin');
      expect(result.code).toBe('Z1');
    });

    it('should prevent deleting zone with non-system bins', async () => {
      const [loc] = await pg.db
        .insert(locations)
        .values({ code: 'L1', name: 'L1', source: 'app', createdBy: 'system' })
        .returning();
      const [zone] = await pg.db
        .insert(zones)
        .values({
          locationId: loc.locationId,
          code: 'Z1',
          name: 'Zone 1',
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      await pg.db.insert(bins).values({
        zoneId: zone.zoneId,
        binNumber: 'B1',
        binType: 'storage',
        source: 'app',
        createdBy: 'system',
        isUnavailable: false,
        isBonded: false,
      });

      await expect(service.deleteZone(zone.zoneId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should prevent deleting zone with historical inventory ledger entries', async () => {
      const [loc] = await pg.db
        .insert(locations)
        .values({ code: 'L1', name: 'L1', source: 'app', createdBy: 'system' })
        .returning();
      const [zone] = await pg.db
        .insert(zones)
        .values({
          locationId: loc.locationId,
          code: 'CUSTOM_Z1',
          name: 'Custom Zone 1',
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      const [bin] = await pg.db
        .insert(bins)
        .values({
          zoneId: zone.zoneId,
          binNumber: 'B1',
          binType: 'storage',
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      const [prod] = await pg.db
        .insert(products)
        .values({
          productNumber: 'P1',
          name: 'Product 1',
          productType: 'inventory',
          structureType: 'standard',
          baseUom: 'EA',
          stateCode: PRODUCT_STATE.ACTIVE,
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      const [entry] = await pg.db
        .insert(inventoryEntries)
        .values({
          entryNumber: 'ENT-1',
          sourceType: 'GOODS_RECEIPT',
          sourceId: loc.locationId,
          isReversed: false,
          createdBy: 'system',
        })
        .returning();
      await pg.db.insert(inventoryLedger).values({
        entryId: entry.entryId,
        productId: prod.productId,
        binId: bin.binId,
        locationId: loc.locationId,
        zoneId: zone.zoneId,
        quantity: '10',
      });

      await expect(service.deleteZone(zone.zoneId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Bins', () => {
    it('should create a bin', async () => {
      const [loc] = await pg.db
        .insert(locations)
        .values({ code: 'L1', name: 'L1', source: 'app', createdBy: 'system' })
        .returning();
      const [zone] = await pg.db
        .insert(zones)
        .values({
          locationId: loc.locationId,
          code: 'Z1',
          name: 'Z1',
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      const dto = {
        zoneId: zone.zoneId,
        binNumber: 'B1',
        binType: 'storage',
      };
      const result = await service.createBin(dto as any, 'admin');
      expect(result.binNumber).toBe('B1');
    });

    it('should successfully delete an empty bin without stock records', async () => {
      const [loc] = await pg.db
        .insert(locations)
        .values({ code: 'L1', name: 'L1', source: 'app', createdBy: 'system' })
        .returning();
      const [zone] = await pg.db
        .insert(zones)
        .values({
          locationId: loc.locationId,
          code: 'Z1',
          name: 'Z1',
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      const [bin] = await pg.db
        .insert(bins)
        .values({
          zoneId: zone.zoneId,
          binNumber: 'B1',
          binType: 'storage',
          source: 'app',
          createdBy: 'system',
        })
        .returning();

      const res = await service.deleteBin(bin.binId);
      expect(res.success).toBe(true);

      const rows = await pg.db
        .select()
        .from(bins)
        .where(eq(bins.binId, bin.binId));
      expect(rows).toHaveLength(0);
    });

    it('should successfully delete an empty bin that has 0-quantity bin_contents cache entries (ADV-161)', async () => {
      const [loc] = await pg.db
        .insert(locations)
        .values({ code: 'L1', name: 'L1', source: 'app', createdBy: 'system' })
        .returning();
      const [zone] = await pg.db
        .insert(zones)
        .values({
          locationId: loc.locationId,
          code: 'Z1',
          name: 'Z1',
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      const [bin] = await pg.db
        .insert(bins)
        .values({
          zoneId: zone.zoneId,
          binNumber: 'B1',
          binType: 'storage',
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      const [prod] = await pg.db
        .insert(products)
        .values({
          productNumber: 'P1',
          name: 'Product 1',
          productType: 'inventory',
          structureType: 'standard',
          baseUom: 'EA',
          stateCode: PRODUCT_STATE.ACTIVE,
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      await pg.db.insert(binContents).values({
        binId: bin.binId,
        productId: prod.productId,
        actualQuantity: '0',
      });

      const res = await service.deleteBin(bin.binId);
      expect(res.success).toBe(true);

      const binRows = await pg.db
        .select()
        .from(bins)
        .where(eq(bins.binId, bin.binId));
      expect(binRows).toHaveLength(0);

      const cacheRows = await pg.db
        .select()
        .from(binContents)
        .where(eq(binContents.binId, bin.binId));
      expect(cacheRows).toHaveLength(0);
    });

    it('should prevent deleting bin with positive stock', async () => {
      const [loc] = await pg.db
        .insert(locations)
        .values({ code: 'L1', name: 'L1', source: 'app', createdBy: 'system' })
        .returning();
      const [zone] = await pg.db
        .insert(zones)
        .values({
          locationId: loc.locationId,
          code: 'Z1',
          name: 'Z1',
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      const [bin] = await pg.db
        .insert(bins)
        .values({
          zoneId: zone.zoneId,
          binNumber: 'B1',
          binType: 'storage',
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      const [prod] = await pg.db
        .insert(products)
        .values({
          productNumber: 'P1',
          name: 'Product 1',
          productType: 'inventory',
          structureType: 'standard',
          baseUom: 'EA',
          stateCode: PRODUCT_STATE.ACTIVE,
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      await pg.db.insert(binContents).values({
        binId: bin.binId,
        productId: prod.productId,
        actualQuantity: '15',
      });

      await expect(service.deleteBin(bin.binId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should prevent deleting bin with historical inventory ledger entries', async () => {
      const [loc] = await pg.db
        .insert(locations)
        .values({ code: 'L1', name: 'L1', source: 'app', createdBy: 'system' })
        .returning();
      const [zone] = await pg.db
        .insert(zones)
        .values({
          locationId: loc.locationId,
          code: 'Z1',
          name: 'Z1',
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      const [bin] = await pg.db
        .insert(bins)
        .values({
          zoneId: zone.zoneId,
          binNumber: 'B1',
          binType: 'storage',
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      const [prod] = await pg.db
        .insert(products)
        .values({
          productNumber: 'P1',
          name: 'Product 1',
          productType: 'inventory',
          structureType: 'standard',
          baseUom: 'EA',
          stateCode: PRODUCT_STATE.ACTIVE,
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      const [entry] = await pg.db
        .insert(inventoryEntries)
        .values({
          entryNumber: 'ENT-1',
          sourceType: 'GOODS_RECEIPT',
          sourceId: loc.locationId,
          isReversed: false,
          createdBy: 'system',
        })
        .returning();
      await pg.db.insert(inventoryLedger).values({
        entryId: entry.entryId,
        productId: prod.productId,
        binId: bin.binId,
        locationId: loc.locationId,
        zoneId: zone.zoneId,
        quantity: '5',
      });

      await expect(service.deleteBin(bin.binId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should prevent deleting bin assigned to product default bins', async () => {
      const [loc] = await pg.db
        .insert(locations)
        .values({ code: 'L1', name: 'L1', source: 'app', createdBy: 'system' })
        .returning();
      const [zone] = await pg.db
        .insert(zones)
        .values({
          locationId: loc.locationId,
          code: 'Z1',
          name: 'Z1',
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      const [bin] = await pg.db
        .insert(bins)
        .values({
          zoneId: zone.zoneId,
          binNumber: 'B1',
          binType: 'storage',
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      const [prod] = await pg.db
        .insert(products)
        .values({
          productNumber: 'P1',
          name: 'Product 1',
          productType: 'inventory',
          structureType: 'standard',
          baseUom: 'EA',
          stateCode: PRODUCT_STATE.ACTIVE,
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      await pg.db.insert(productDefaultBins).values({
        productId: prod.productId,
        locationId: loc.locationId,
        binId: bin.binId,
        isPrimaryPerLocation: true,
      });

      await expect(service.deleteBin(bin.binId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

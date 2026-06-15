import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, or, sql, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  locations,
  zones,
  bins,
  binContents,
  salesOrders,
  salesOrderLineItems,
  purchaseOrders,
  inventoryLedger,
  appSettings,
} from '../drizzle/herobm-core-schema';
import { CreateLocationDto, CreateZoneDto, CreateBinDto } from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

@Injectable()
export class LocationsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  // ── Locations ─────────────────────────────────────────────────────────────

  async createLocation(dto: CreateLocationDto, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(locations)
        .values({
          ...dto,
          source: 'app',
          createdBy: userId,
        })
        .returning();

      const [settings] = await tx.select().from(appSettings).limit(1);
      if (settings && !settings.defaultFulfillmentLocationId) {
        await tx
          .update(appSettings) // @herobm-skip-audit
          .set({ defaultFulfillmentLocationId: row.locationId })
          .where(eq(appSettings.settingsId, settings.settingsId));
      }

      await emitEvent(tx, {
        entityType: EntityType.LOCATION,
        entityId: row.locationId,
        eventType: EventType.CREATED,
        entityDisplayName: row.name,
        payload: dto,
        actor: userId,
      });

      return row;
    });
  }

  async updateLocation(
    id: string,
    dto: Partial<CreateLocationDto>,
    userId?: string,
  ) {
    return await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(locations)
        .set({ ...dto, modifiedOn: new Date() })
        .where(eq(locations.locationId, id))
        .returning();
      if (!row) throw new NotFoundException(`Location ${id} not found`);

      await emitEvent(tx, {
        entityType: EntityType.LOCATION,
        entityId: row.locationId,
        eventType: EventType.UPDATED,
        entityDisplayName: row.name,
        payload: dto,
        actor: userId,
      });

      return row;
    });
  }

  async deleteLocation(id: string, userId?: string) {
    return await this.db.transaction(async (tx) => {
      // 1. Check for orders
      const [soCount] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(salesOrders)
        .where(eq(salesOrders.fulfillmentLocationId, id));

      const [solCount] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.fulfillmentLocationId, id));

      const [poCount] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.deliveryLocationId, id));

      const orderRefs =
        Number(soCount.count) + Number(solCount.count) + Number(poCount.count);
      if (orderRefs > 0) {
        throw new BadRequestException(
          `Cannot delete location referenced by ${Number(soCount.count)} sales order(s), ${Number(solCount.count)} sales order line(s), and ${Number(poCount.count)} purchase order(s)`,
        );
      }

      // 2. Check for inventory ledger entries
      const [ledgerCount] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(inventoryLedger)
        .where(eq(inventoryLedger.locationId, id));

      if (Number(ledgerCount.count) > 0) {
        throw new BadRequestException(
          `Cannot delete location with ${Number(ledgerCount.count)} inventory ledger entries`,
        );
      }

      // 3. Check for app_settings default reference
      const settingsRef = await tx
        .select({ id: appSettings.settingsId })
        .from(appSettings)
        .where(eq(appSettings.defaultFulfillmentLocationId, id));

      if (settingsRef.length > 0) {
        throw new BadRequestException(
          `Cannot delete location that is set as the default fulfillment location in app settings`,
        );
      }

      // 4. Cascade delete empty system zones and bins
      const zoneList = await tx
        .select({ id: zones.zoneId, code: zones.code, source: zones.source })
        .from(zones)
        .where(eq(zones.locationId, id));

      const nonSystemZones = zoneList.filter((z) => z.source !== 'system');
      if (nonSystemZones.length > 0) {
        throw new BadRequestException(
          `Cannot delete location with ${nonSystemZones.length} existing non-system zones`,
        );
      }

      const zoneIds = zoneList.map((z) => z.id);
      if (zoneIds.length > 0) {
        const binList = await tx
          .select()
          .from(bins)
          .where(inArray(bins.zoneId, zoneIds));
        const nonSystemBins = binList.filter((b) => b.source !== 'system');

        if (nonSystemBins.length > 0) {
          throw new BadRequestException(
            `Cannot delete location with ${nonSystemBins.length} existing non-system bins`,
          );
        }

        for (const bin of binList) {
          const stockCount = await tx
            .select({ count: sql<number>`count(*)` })
            .from(binContents)
            .where(
              and(eq(binContents.binId, bin.binId), sql`actual_quantity > 0`),
            );

          if (Number(stockCount[0].count) > 0) {
            throw new BadRequestException(
              `Cannot delete location because system bin ${bin.binNumber} contains stock.`,
            );
          }
        }

        if (binList.length > 0) {
          await tx.delete(bins).where(inArray(bins.zoneId, zoneIds));
        }
        await tx.delete(zones).where(eq(zones.locationId, id));
      }

      const [row] = await tx
        .delete(locations)
        .where(eq(locations.locationId, id))
        .returning();

      if (!row) throw new NotFoundException(`Location ${id} not found`);

      await emitEvent(tx, {
        entityType: EntityType.LOCATION,
        entityId: row.locationId,
        eventType: EventType.DELETED,
        entityDisplayName: row.name,
        payload: {},
        actor: userId,
      });

      return { success: true };
    });
  }

  // ── Zones ─────────────────────────────────────────────────────────────────

  async createZone(dto: CreateZoneDto, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(zones)
        .values({
          ...dto,
          source: 'app',
          createdBy: userId,
        })
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.ZONE,
        entityId: row.zoneId,
        eventType: EventType.CREATED,
        entityDisplayName: row.code,
        payload: dto,
        actor: userId,
      });

      return row;
    });
  }

  async updateZone(id: string, dto: Partial<CreateZoneDto>, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(zones)
        .set({ ...dto, modifiedOn: new Date() })
        .where(eq(zones.zoneId, id))
        .returning();
      if (!row) throw new NotFoundException(`Zone ${id} not found`);

      await emitEvent(tx, {
        entityType: EntityType.ZONE,
        entityId: row.zoneId,
        eventType: EventType.UPDATED,
        entityDisplayName: row.code,
        payload: dto,
        actor: userId,
      });

      return row;
    });
  }

  async deleteZone(id: string, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const [zone] = await tx.select().from(zones).where(eq(zones.zoneId, id));
      if (!zone) throw new NotFoundException(`Zone ${id} not found`);

      // 1. Check for bins
      const binList = await tx.select().from(bins).where(eq(bins.zoneId, id));

      const nonSystemBins = binList.filter((b) => b.source !== 'system');
      if (nonSystemBins.length > 0) {
        throw new BadRequestException(
          `Cannot delete zone with ${nonSystemBins.length} existing non-system bins`,
        );
      }

      for (const bin of binList) {
        const stockCount = await tx
          .select({ count: sql<number>`count(*)` })
          .from(binContents)
          .where(
            and(eq(binContents.binId, bin.binId), sql`actual_quantity > 0`),
          );

        if (Number(stockCount[0].count) > 0) {
          throw new BadRequestException(
            `Cannot delete zone because system bin ${bin.binNumber} contains stock.`,
          );
        }
      }

      if (binList.length > 0) {
        await tx.delete(bins).where(eq(bins.zoneId, id));
      }

      const [row] = await tx
        .delete(zones)
        .where(eq(zones.zoneId, id))
        .returning();
      if (!row) throw new NotFoundException(`Zone ${id} not found`);

      await emitEvent(tx, {
        entityType: EntityType.ZONE,
        entityId: row.zoneId,
        eventType: EventType.DELETED,
        entityDisplayName: row.code,
        payload: {},
        actor: userId,
      });

      return { success: true };
    });
  }

  // ── Bins ──────────────────────────────────────────────────────────────────

  async createBin(dto: CreateBinDto, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(bins)
        .values({
          ...dto,
          source: 'app',
          createdBy: userId,
        })
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.BIN,
        entityId: row.binId,
        eventType: EventType.CREATED,
        entityDisplayName: row.binNumber,
        payload: dto,
        actor: userId,
      });

      return row;
    });
  }

  async updateBin(id: string, dto: Partial<CreateBinDto>, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(bins)
        .set({ ...dto, modifiedOn: new Date() })
        .where(eq(bins.binId, id))
        .returning();
      if (!row) throw new NotFoundException(`Bin ${id} not found`);

      await emitEvent(tx, {
        entityType: EntityType.BIN,
        entityId: row.binId,
        eventType: EventType.UPDATED,
        entityDisplayName: row.binNumber,
        payload: dto,
        actor: userId,
      });

      return row;
    });
  }

  async deleteBin(id: string, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const [bin] = await tx.select().from(bins).where(eq(bins.binId, id));
      if (!bin) throw new NotFoundException(`Bin ${id} not found`);

      // 1. Check for stock (bin_contents)
      const stockCount = await tx
        .select({ count: sql`count(*)` })
        .from(binContents)
        .where(and(eq(binContents.binId, id), sql`actual_quantity > 0`));

      if (Number(stockCount[0].count) > 0) {
        throw new BadRequestException(
          `Cannot delete bin containing ${Number(stockCount[0].count)} active stock records`,
        );
      }

      const [row] = await tx.delete(bins).where(eq(bins.binId, id)).returning();
      if (!row) throw new NotFoundException(`Bin ${id} not found`);

      await emitEvent(tx, {
        entityType: EntityType.BIN,
        entityId: row.binId,
        eventType: EventType.DELETED,
        entityDisplayName: row.binNumber,
        payload: {},
        actor: userId,
      });

      return { success: true };
    });
  }
}

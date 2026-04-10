import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, or, sql } from 'drizzle-orm';
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
} from '../drizzle/modbm-core-schema';
import { CreateLocationDto, CreateZoneDto, CreateBinDto } from './dto';

@Injectable()
export class LocationsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  // ── Locations ─────────────────────────────────────────────────────────────

  async createLocation(dto: CreateLocationDto, userId?: string) {
    const [row] = await this.db
      .insert(locations)
      .values({
        ...dto,
        source: 'app',
        createdBy: userId,
      })
      .returning();
    return row;
  }

  async updateLocation(id: string, dto: Partial<CreateLocationDto>) {
    const [row] = await this.db
      .update(locations)
      .set({ ...dto, modifiedOn: new Date() })
      .where(eq(locations.locationId, id))
      .returning();
    if (!row) throw new NotFoundException(`Location ${id} not found`);
    return row;
  }

  async deleteLocation(id: string) {
    // 1. Check for zones
    const zoneList = await this.db
      .select({ id: zones.zoneId, code: zones.code })
      .from(zones)
      .where(eq(zones.locationId, id));

    if (zoneList.length > 0) {
      throw new BadRequestException(
        `Cannot delete location with ${zoneList.length} existing zones: ${zoneList.map((z) => z.code).join(', ')}`,
      );
    }

    // 2. Check for referencing orders
    const [soCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(salesOrders)
      .where(eq(salesOrders.fulfillmentLocationId, id));

    const [solCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.fulfillmentLocationId, id));

    const [poCount] = await this.db
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

    // 3. Check for inventory ledger entries
    const [ledgerCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryLedger)
      .where(eq(inventoryLedger.locationId, id));

    if (Number(ledgerCount.count) > 0) {
      throw new BadRequestException(
        `Cannot delete location with ${Number(ledgerCount.count)} inventory ledger entries`,
      );
    }

    // 4. Check for app_settings default reference
    const settingsRef = await this.db
      .select({ id: appSettings.settingsId })
      .from(appSettings)
      .where(eq(appSettings.defaultFulfillmentLocationId, id));

    if (settingsRef.length > 0) {
      throw new BadRequestException(
        `Cannot delete location that is set as the default fulfillment location in app settings`,
      );
    }

    const [row] = await this.db
      .delete(locations)
      .where(eq(locations.locationId, id))
      .returning();
    if (!row) throw new NotFoundException(`Location ${id} not found`);
    return { success: true };
  }

  // ── Zones ─────────────────────────────────────────────────────────────────

  async createZone(dto: CreateZoneDto, userId?: string) {
    const [row] = await this.db
      .insert(zones)
      .values({
        ...dto,
        source: 'app',
        createdBy: userId,
      })
      .returning();
    return row;
  }

  async updateZone(id: string, dto: Partial<CreateZoneDto>) {
    const [row] = await this.db
      .update(zones)
      .set({ ...dto, modifiedOn: new Date() })
      .where(eq(zones.zoneId, id))
      .returning();
    if (!row) throw new NotFoundException(`Zone ${id} not found`);
    return row;
  }

  async deleteZone(id: string) {
    const [zone] = await this.db
      .select()
      .from(zones)
      .where(eq(zones.zoneId, id));
    if (!zone) throw new NotFoundException(`Zone ${id} not found`);

    // 1. Check for bins
    const binCount = await this.db
      .select({ count: sql`count(*)` })
      .from(bins)
      .where(eq(bins.zoneId, id));

    if (Number(binCount[0].count) > 0) {
      throw new BadRequestException(
        `Cannot delete zone with ${Number(binCount[0].count)} existing bins`,
      );
    }

    const [row] = await this.db
      .delete(zones)
      .where(eq(zones.zoneId, id))
      .returning();
    if (!row) throw new NotFoundException(`Zone ${id} not found`);
    return { success: true };
  }

  // ── Bins ──────────────────────────────────────────────────────────────────

  async createBin(dto: CreateBinDto, userId?: string) {
    const [row] = await this.db
      .insert(bins)
      .values({
        ...dto,
        source: 'app',
        createdBy: userId,
      })
      .returning();
    return row;
  }

  async updateBin(id: string, dto: Partial<CreateBinDto>) {
    const [row] = await this.db
      .update(bins)
      .set({ ...dto, modifiedOn: new Date() })
      .where(eq(bins.binId, id))
      .returning();
    if (!row) throw new NotFoundException(`Bin ${id} not found`);
    return row;
  }

  async deleteBin(id: string) {
    const [bin] = await this.db.select().from(bins).where(eq(bins.binId, id));
    if (!bin) throw new NotFoundException(`Bin ${id} not found`);

    // 1. Check for stock (bin_contents)
    const stockCount = await this.db
      .select({ count: sql`count(*)` })
      .from(binContents)
      .where(and(eq(binContents.binId, id), sql`actual_quantity > 0`));

    if (Number(stockCount[0].count) > 0) {
      throw new BadRequestException(
        `Cannot delete bin containing ${Number(stockCount[0].count)} active stock records`,
      );
    }

    const [row] = await this.db
      .delete(bins)
      .where(eq(bins.binId, id))
      .returning();
    if (!row) throw new NotFoundException(`Bin ${id} not found`);
    return { success: true };
  }
}

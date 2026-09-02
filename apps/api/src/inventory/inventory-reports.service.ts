import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import {
  products,
  locations,
  bins,
  zones,
  inventoryLevels,
  inventoryLedger,
  inventoryEntries,
  productDefaultBins,
  productGroups,
  binContents,
} from '@herobm/db-schema';
import { sql, eq, and, gte, lte } from 'drizzle-orm';
import { isQuarantineBinCondition } from './inventory-math.utils';

@Injectable()
export class InventoryReportsService implements OnModuleInit {
  private readonly logger = new Logger(InventoryReportsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly registry: DataSourcesRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(DATA_SOURCE_CONTEXT.INVENTORY_VALUATION, {
      fetchData: (filters: Record<string, unknown>) =>
        this.getInventoryValuation(filters),
    });
    this.registry.register(DATA_SOURCE_CONTEXT.INVENTORY_MOVEMENTS, {
      fetchData: (filters: Record<string, unknown>) =>
        this.getInventoryMovements(filters),
    });
    this.registry.register(DATA_SOURCE_CONTEXT.INVENTORY_REPLENISHMENT, {
      fetchData: (filters: Record<string, unknown>) =>
        this.getInventoryReplenishment(filters),
    });
    this.registry.register(DATA_SOURCE_CONTEXT.INVENTORY_QUARANTINE, {
      fetchData: (filters: Record<string, unknown>) =>
        this.getInventoryQuarantine(filters),
    });
  }

  async getInventoryValuation(filters: Record<string, unknown>) {
    const rows = await this.db
      .select({
        productNumber: products.productNumber,
        productName: products.name,
        quantityOnHand: inventoryLevels.quantityOnHand,
        unitCost: products.standardCost,
        totalValue: sql<number>`(${inventoryLevels.quantityOnHand} * ${products.standardCost})::numeric`,
        locationName: locations.name,
        productGroupName: sql<string>`coalesce(${productGroups.name}, 'Unassigned')`,
      })
      .from(inventoryLevels)
      .innerJoin(products, eq(inventoryLevels.productId, products.productId))
      .innerJoin(
        locations,
        eq(inventoryLevels.locationId, locations.locationId),
      )
      .leftJoin(
        productGroups,
        eq(products.productGroupId, productGroups.productGroupId),
      )
      .where(sql`${inventoryLevels.quantityOnHand} > 0`);

    return rows;
  }

  async getInventoryMovements(filters: Record<string, unknown>) {
    const conditions = [];
    if (filters.fromDate)
      conditions.push(
        sql`${inventoryEntries.entryDate} >= ${filters.fromDate}::timestamp`,
      );
    if (filters.toDate)
      conditions.push(
        sql`${inventoryEntries.entryDate} < (${filters.toDate}::date + interval '1 day')`,
      );
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select({
        productNumber: products.productNumber,
        productName: products.name,
        locationName: locations.name,
        movementType: inventoryEntries.sourceType,
        qtyIn: sql<number>`sum(case when ${inventoryLedger.quantity} > 0 then ${inventoryLedger.quantity} else 0 end)::numeric`,
        qtyOut: sql<number>`sum(case when ${inventoryLedger.quantity} < 0 then abs(${inventoryLedger.quantity}) else 0 end)::numeric`,
        startingQty: sql<number>`0::numeric`,
        endingQty: sql<number>`0::numeric`,
      })
      .from(inventoryLedger)
      .innerJoin(
        inventoryEntries,
        eq(inventoryLedger.entryId, inventoryEntries.entryId),
      )
      .innerJoin(products, eq(inventoryLedger.productId, products.productId))
      .innerJoin(
        locations,
        eq(inventoryLedger.locationId, locations.locationId),
      )
      .where(whereClause)
      .groupBy(
        products.productNumber,
        products.name,
        locations.name,
        inventoryEntries.sourceType,
      );

    return rows;
  }

  async getInventoryReplenishment(filters: Record<string, unknown>) {
    const rows = await this.db
      .select({
        productNumber: products.productNumber,
        productName: products.name,
        currentQty: inventoryLevels.quantityOnHand,
        minLevel: productDefaultBins.minQuantity,
        deficit: sql<number>`(${productDefaultBins.minQuantity} - ${inventoryLevels.quantityOnHand})::numeric`,
        suggestedOrderQty: sql<number>`(COALESCE(${productDefaultBins.maxQuantity}, ${productDefaultBins.minQuantity} * 2) - ${inventoryLevels.quantityOnHand})::numeric`,
        productGroupName: sql<string>`coalesce(${productGroups.name}, 'Unassigned')`,
      })
      .from(productDefaultBins)
      .innerJoin(
        inventoryLevels,
        and(
          eq(productDefaultBins.productId, inventoryLevels.productId),
          eq(productDefaultBins.locationId, inventoryLevels.locationId),
        ),
      )
      .innerJoin(products, eq(productDefaultBins.productId, products.productId))
      .leftJoin(
        productGroups,
        eq(products.productGroupId, productGroups.productGroupId),
      )
      .where(
        sql`${inventoryLevels.quantityOnHand} < ${productDefaultBins.minQuantity}`,
      );

    return rows.map((r) => ({
      ...r,
      supplierName: 'Main Supplier', // Placeholder until supplier-product mapping is established
    }));
  }

  async getInventoryQuarantine(filters: Record<string, unknown>) {
    const rows = await this.db
      .select({
        productNumber: products.productNumber,
        productName: products.name,
        quarantineQty: binContents.actualQuantity,
        reason: sql<string>`'Quarantine Bin'`,
        locationName: locations.name,
      })
      .from(binContents)
      .innerJoin(bins, eq(binContents.binId, bins.binId))
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .innerJoin(locations, eq(zones.locationId, locations.locationId))
      .innerJoin(products, eq(binContents.productId, products.productId))
      .where(
        and(
          isQuarantineBinCondition(bins),
          sql`${binContents.actualQuantity} > 0`,
        ),
      );

    return rows;
  }
}

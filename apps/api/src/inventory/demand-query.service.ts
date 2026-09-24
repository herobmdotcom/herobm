import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../drizzle/drizzle.module';
import {
  products,
  locations,
  bins,
  inventoryLedger,
  inventoryEntries,
  inventoryLevels,
  productDefaultBins,
  productGroups,
  productSuppliers,
  suppliers,
  organizations,
  zones,
} from '@herobm/db-schema';
import { eq, and, sql, desc, isNotNull, inArray, or, ilike } from 'drizzle-orm';
import { calculateAvailableQuantity } from '@herobm/shared';
import { calculateSuggestedRestockQuantity } from './inventory-math.utils';
import { AppConfigService } from '../settings/app-config.service';

@Injectable()
export class DemandQueryService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase,
    private readonly appConfig: AppConfigService,
  ) {}

  async getRestockList(params?: {
    locationId?: string;
    productGroupId?: string;
    q?: string;
  }) {
    const rawSearchTerm = params?.q
      ? params.q.trim().replace(/^%+|%+$/g, '')
      : '';

    const conditions = [
      sql`${products.stateCode} != 'archived'`,
      eq(products.productType, 'inventory'),
      isNotNull(productDefaultBins.minQuantity),
      sql`CAST(${productDefaultBins.minQuantity} AS numeric) > 0`,
    ];

    if (params?.locationId && params.locationId !== 'all') {
      conditions.push(eq(productDefaultBins.locationId, params.locationId));
    }

    if (params?.productGroupId && params.productGroupId !== 'all') {
      conditions.push(eq(products.productGroupId, params.productGroupId));
    }

    if (rawSearchTerm) {
      const term = `%${rawSearchTerm}%`;
      const searchCond = or(
        ilike(products.name, term),
        ilike(products.productNumber, term),
        ilike(products.alternateProductNumber, term),
        ilike(locations.name, term),
        ilike(locations.code, term),
        ilike(bins.binNumber, term),
      );
      if (searchCond) {
        conditions.push(searchCond);
      }
    }

    const rows = await this.db
      .select({
        productDefaultBinId: productDefaultBins.productDefaultBinId,
        productId: productDefaultBins.productId,
        productNumber: products.productNumber,
        productName: products.name,
        productDescription: products.alternateInvoiceDescription,
        productType: products.productType,
        baseUom: products.baseUom,
        productGroupId: products.productGroupId,
        productGroupName: productGroups.name,
        productGroupCode: productGroups.groupCode,
        locationId: productDefaultBins.locationId,
        locationName: locations.name,
        locationCode: locations.code,
        binId: productDefaultBins.binId,
        binNumber: bins.binNumber,
        binType: bins.binType,
        zoneCode: zones.code,
        zoneName: zones.name,
        minQuantity:
          sql<number>`CAST(${productDefaultBins.minQuantity} AS numeric)`.mapWith(
            Number,
          ),
        maxQuantity: sql<
          number | null
        >`CASE WHEN ${productDefaultBins.maxQuantity} IS NOT NULL THEN CAST(${productDefaultBins.maxQuantity} AS numeric) ELSE NULL END`.mapWith(
          Number,
        ),
        standardCost: sql<
          number | null
        >`CASE WHEN ${products.standardCost} IS NOT NULL THEN CAST(${products.standardCost} AS numeric) ELSE NULL END`.mapWith(
          Number,
        ),
      })
      .from(productDefaultBins)
      .innerJoin(products, eq(productDefaultBins.productId, products.productId))
      .leftJoin(
        productGroups,
        eq(products.productGroupId, productGroups.productGroupId),
      )
      .innerJoin(
        locations,
        eq(productDefaultBins.locationId, locations.locationId),
      )
      .innerJoin(bins, eq(productDefaultBins.binId, bins.binId))
      .leftJoin(zones, eq(bins.zoneId, zones.zoneId))
      .where(and(...conditions));

    if (rows.length === 0) {
      return {
        data: [],
        summary: {
          totalItems: 0,
          totalSuggestedUnits: 0,
          totalEstimatedCost: 0,
        },
      };
    }

    const productIds = Array.from(new Set(rows.map((r) => r.productId)));
    const locationIds = Array.from(new Set(rows.map((r) => r.locationId)));

    const invLevels = await this.db
      .select({
        productId: inventoryLevels.productId,
        locationId: inventoryLevels.locationId,
        quantityOnHand:
          sql<number>`COALESCE(${inventoryLevels.quantityOnHand}, 0)`.mapWith(
            Number,
          ),
        quantityCommitted:
          sql<number>`COALESCE(${inventoryLevels.quantityCommitted}, 0)`.mapWith(
            Number,
          ),
        quantityOnOrder:
          sql<number>`COALESCE(${inventoryLevels.quantityOnOrder}, 0)`.mapWith(
            Number,
          ),
      })
      .from(inventoryLevels)
      .where(
        and(
          inArray(inventoryLevels.productId, productIds),
          inArray(inventoryLevels.locationId, locationIds),
        ),
      );

    const invMap = new Map<
      string,
      { onHand: number; committed: number; onOrder: number }
    >();
    for (const lvl of invLevels) {
      if (lvl.productId && lvl.locationId) {
        invMap.set(`${lvl.productId}_${lvl.locationId}`, {
          onHand: lvl.quantityOnHand,
          committed: lvl.quantityCommitted,
          onOrder: lvl.quantityOnOrder,
        });
      }
    }

    const supplierRows = await this.db
      .select({
        productId: productSuppliers.productId,
        vendorId: productSuppliers.vendorId,
        vendorName: sql<
          string | null
        >`COALESCE(${organizations.name}, ${suppliers.vendorNumber})`,
        costPrice: sql<
          number | null
        >`CASE WHEN ${productSuppliers.costPrice} IS NOT NULL THEN CAST(${productSuppliers.costPrice} AS numeric) ELSE NULL END`.mapWith(
          Number,
        ),
        currencyCode: suppliers.currencyCode,
        minPurchaseQty: sql<
          number | null
        >`CASE WHEN ${productSuppliers.minPurchaseQty} IS NOT NULL THEN CAST(${productSuppliers.minPurchaseQty} AS numeric) ELSE NULL END`.mapWith(
          Number,
        ),
        purchaseUnit: productSuppliers.purchaseUnit,
        isPreferred: productSuppliers.isPreferred,
      })
      .from(productSuppliers)
      .innerJoin(suppliers, eq(productSuppliers.vendorId, suppliers.vendorId))
      .leftJoin(
        organizations,
        eq(suppliers.organizationId, organizations.organizationId),
      )
      .where(inArray(productSuppliers.productId, productIds));

    const supplierMap = new Map<string, (typeof supplierRows)[0]>();
    for (const s of supplierRows) {
      if (!supplierMap.has(s.productId) || s.isPreferred) {
        supplierMap.set(s.productId, s);
      }
    }

    const restockItems = [];
    let totalSuggestedUnits = 0;
    let totalEstimatedCost = 0;

    for (const row of rows) {
      const inv = invMap.get(`${row.productId}_${row.locationId}`) || {
        onHand: 0,
        committed: 0,
        onOrder: 0,
      };

      const availableQty = Math.max(
        0,
        calculateAvailableQuantity(inv.onHand, inv.committed),
      );
      const minQty = row.minQuantity;
      const maxQty = row.maxQuantity ?? null;

      const sup = supplierMap.get(row.productId);
      const suggestedQty = calculateSuggestedRestockQuantity({
        onHand: inv.onHand,
        onOrder: inv.onOrder,
        minQuantity: minQty,
        maxQuantity: maxQty,
        minPurchaseQty: sup?.minPurchaseQty,
      });

      if (suggestedQty > 0) {
        const unitCost = sup?.costPrice ?? row.standardCost ?? 0;
        const effectiveSuggested = suggestedQty;
        const estCost = effectiveSuggested * unitCost;

        totalSuggestedUnits += effectiveSuggested;
        totalEstimatedCost += estCost;

        restockItems.push({
          id: `${row.productId}_${row.locationId}_${row.binId}`,
          productId: row.productId,
          productNumber: row.productNumber,
          productName: row.productName,
          productDescription: row.productDescription || null,
          productGroupId: row.productGroupId || null,
          productGroupName: row.productGroupName || null,
          productGroupCode: row.productGroupCode || null,
          productType: row.productType,
          baseUom: row.baseUom,
          locationId: row.locationId,
          locationName: row.locationName,
          locationCode: row.locationCode,
          binId: row.binId,
          binNumber: row.binNumber,
          binType: row.binType,
          zoneCode: row.zoneCode || null,
          zoneName: row.zoneName || null,
          quantityOnHand: inv.onHand,
          quantityCommitted: inv.committed,
          quantityOnOrder: inv.onOrder,
          availableQuantity: availableQty,
          minQuantity: minQty,
          maxQuantity: maxQty,
          suggestedRestockQty: effectiveSuggested,
          vendorId: sup?.vendorId || null,
          vendorName: sup?.vendorName || null,
          costPrice: sup?.costPrice ?? row.standardCost ?? null,
          currencyCode: sup?.currencyCode || this.appConfig.homeCurrency(),
          minPurchaseQty: sup?.minPurchaseQty || null,
          purchaseUnit: sup?.purchaseUnit || null,
        });
      }
    }

    return {
      data: restockItems,
      summary: {
        totalItems: restockItems.length,
        totalSuggestedUnits,
        totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
      },
    };
  }

  async getStockMovementReport(params?: {
    productGroupId?: string;
    locationId?: string;
    startDate?: string;
    endDate?: string;
    q?: string;
  }) {
    const rawSearchTerm = params?.q
      ? params.q.trim().replace(/^%+|%+$/g, '')
      : '';

    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const defaultEnd = now.toISOString().slice(0, 10);

    const startDate = params?.startDate || defaultStart;
    const endDate = params?.endDate || defaultEnd;
    const startIso = `${startDate}T00:00:00.000Z`;
    const endIso = `${endDate}T23:59:59.999Z`;

    const productConditions = [sql`${products.stateCode} != 'archived'`];

    if (params?.productGroupId && params.productGroupId !== 'all') {
      productConditions.push(
        eq(products.productGroupId, params.productGroupId),
      );
    }

    if (rawSearchTerm) {
      const term = `%${rawSearchTerm}%`;
      const searchCond = or(
        ilike(products.name, term),
        ilike(products.productNumber, term),
        ilike(products.alternateProductNumber, term),
      );
      if (searchCond) {
        productConditions.push(searchCond);
      }
    }

    const prodRows = await this.db
      .select({
        productId: products.productId,
        productNumber: products.productNumber,
        productName: products.name,
        baseUom: products.baseUom,
        productGroupId: products.productGroupId,
        productGroupName: productGroups.name,
      })
      .from(products)
      .leftJoin(
        productGroups,
        eq(products.productGroupId, productGroups.productGroupId),
      )
      .where(and(...productConditions));

    if (prodRows.length === 0) {
      return {
        data: [],
        movements: [],
        summary: {
          totalProducts: 0,
          totalOpening: 0,
          totalIn: 0,
          totalOut: 0,
          totalNet: 0,
          totalClosing: 0,
        },
      };
    }

    const productIds = prodRows.map((p) => p.productId);
    const hasLocation = params?.locationId && params.locationId !== 'all';

    // 1. Opening balance before startDate
    const openingConditions = [
      inArray(inventoryLedger.productId, productIds),
      eq(inventoryEntries.isReversed, false),
      sql`${inventoryEntries.entryDate} < ${startIso}`,
    ];
    if (hasLocation) {
      openingConditions.push(
        eq(inventoryLedger.locationId, params.locationId!),
      );
    }

    const openingRows = await this.db
      .select({
        productId: inventoryLedger.productId,
        openingQty:
          sql<number>`COALESCE(SUM(${inventoryLedger.quantity}), 0)`.mapWith(
            Number,
          ),
      })
      .from(inventoryLedger)
      .innerJoin(
        inventoryEntries,
        eq(inventoryLedger.entryId, inventoryEntries.entryId),
      )
      .where(and(...openingConditions))
      .groupBy(inventoryLedger.productId);

    const openingMap = new Map<string, number>();
    for (const r of openingRows) {
      openingMap.set(r.productId, r.openingQty);
    }

    // 2. Movements in date range
    const movementConditions = [
      inArray(inventoryLedger.productId, productIds),
      eq(inventoryEntries.isReversed, false),
      sql`${inventoryEntries.entryDate} >= ${startIso}`,
      sql`${inventoryEntries.entryDate} <= ${endIso}`,
    ];
    if (hasLocation) {
      movementConditions.push(
        eq(inventoryLedger.locationId, params.locationId!),
      );
    }

    const movementLines = await this.db
      .select({
        ledgerId: inventoryLedger.ledgerId,
        entryId: inventoryEntries.entryId,
        entryNumber: inventoryEntries.entryNumber,
        entryDate: sql<string>`${inventoryEntries.entryDate}::text`,
        sourceType: inventoryEntries.sourceType,
        memo: inventoryEntries.memo,
        createdBy: inventoryEntries.createdBy,
        productId: inventoryLedger.productId,
        productNumber: products.productNumber,
        productName: products.name,
        productGroupId: products.productGroupId,
        productGroupName: productGroups.name,
        locationId: inventoryLedger.locationId,
        locationName: locations.name,
        locationCode: locations.code,
        binId: inventoryLedger.binId,
        binNumber: bins.binNumber,
        quantity:
          sql<number>`CAST(${inventoryLedger.quantity} AS numeric)`.mapWith(
            Number,
          ),
      })
      .from(inventoryLedger)
      .innerJoin(
        inventoryEntries,
        eq(inventoryLedger.entryId, inventoryEntries.entryId),
      )
      .innerJoin(products, eq(inventoryLedger.productId, products.productId))
      .leftJoin(
        productGroups,
        eq(products.productGroupId, productGroups.productGroupId),
      )
      .innerJoin(
        locations,
        eq(inventoryLedger.locationId, locations.locationId),
      )
      .innerJoin(bins, eq(inventoryLedger.binId, bins.binId))
      .where(and(...movementConditions))
      .orderBy(
        desc(inventoryEntries.entryDate),
        desc(inventoryLedger.ledgerId),
      );

    // 3. Current on-hand
    const currentOnHandConditions = [
      inArray(inventoryLevels.productId, productIds),
    ];
    if (hasLocation) {
      currentOnHandConditions.push(
        eq(inventoryLevels.locationId, params.locationId!),
      );
    }

    const currentOnHandRows = await this.db
      .select({
        productId: inventoryLevels.productId,
        onHand:
          sql<number>`COALESCE(SUM(${inventoryLevels.quantityOnHand}), 0)`.mapWith(
            Number,
          ),
      })
      .from(inventoryLevels)
      .where(and(...currentOnHandConditions))
      .groupBy(inventoryLevels.productId);

    const onHandMap = new Map<string, number>();
    for (const r of currentOnHandRows) {
      if (r.productId) {
        onHandMap.set(r.productId, r.onHand);
      }
    }

    // 4. Aggregate movements by product
    const productMovementsMap = new Map<
      string,
      {
        stockIn: number;
        stockOut: number;
        breakdown: {
          poReceipts: number;
          soShipments: number;
          customerReturns: number;
          supplierReturns: number;
          adjustments: number;
          transfersIn: number;
          transfersOut: number;
          workOrders: number;
        };
      }
    >();

    for (const line of movementLines) {
      const pId = line.productId;
      const current = productMovementsMap.get(pId) || {
        stockIn: 0,
        stockOut: 0,
        breakdown: {
          poReceipts: 0,
          soShipments: 0,
          customerReturns: 0,
          supplierReturns: 0,
          adjustments: 0,
          transfersIn: 0,
          transfersOut: 0,
          workOrders: 0,
        },
      };

      const qty = line.quantity;
      if (qty > 0) {
        current.stockIn += qty;
      } else {
        current.stockOut += Math.abs(qty);
      }

      const st = (line.sourceType || '').toUpperCase();
      if (st.includes('PO_RECEIPT') || st.includes('RECEIPT')) {
        current.breakdown.poReceipts += qty;
      } else if (
        st.includes('SO_SHIPMENT') ||
        st.includes('SHIPMENT') ||
        st.includes('SO_PICK')
      ) {
        current.breakdown.soShipments += Math.abs(qty);
      } else if (st.includes('RETURN') && qty > 0) {
        current.breakdown.customerReturns += qty;
      } else if (st.includes('RETURN') && qty < 0) {
        current.breakdown.supplierReturns += Math.abs(qty);
      } else if (st.includes('ADJUSTMENT')) {
        current.breakdown.adjustments += qty;
      } else if (st.includes('TRANSFER') && qty > 0) {
        current.breakdown.transfersIn += qty;
      } else if (st.includes('TRANSFER') && qty < 0) {
        current.breakdown.transfersOut += Math.abs(qty);
      } else if (
        st.includes('WORK_ORDER') ||
        st.includes('MANUFACTURING') ||
        st.includes('WIP')
      ) {
        current.breakdown.workOrders += qty;
      }

      productMovementsMap.set(pId, current);
    }

    let totalOpening = 0;
    let totalIn = 0;
    let totalOut = 0;
    let totalNet = 0;
    let totalClosing = 0;

    const data = prodRows.map((p) => {
      const opening = openingMap.get(p.productId) || 0;
      const mv = productMovementsMap.get(p.productId) || {
        stockIn: 0,
        stockOut: 0,
        breakdown: {
          poReceipts: 0,
          soShipments: 0,
          customerReturns: 0,
          supplierReturns: 0,
          adjustments: 0,
          transfersIn: 0,
          transfersOut: 0,
          workOrders: 0,
        },
      };

      const netMovement = mv.stockIn - mv.stockOut;
      const closing = opening + netMovement;
      const currentOnHand = onHandMap.get(p.productId) || 0;

      totalOpening += opening;
      totalIn += mv.stockIn;
      totalOut += mv.stockOut;
      totalNet += netMovement;
      totalClosing += closing;

      return {
        productId: p.productId,
        productNumber: p.productNumber,
        productName: p.productName,
        productGroupId: p.productGroupId,
        productGroupName: p.productGroupName,
        baseUom: p.baseUom,
        openingQuantity: opening,
        stockIn: mv.stockIn,
        stockOut: mv.stockOut,
        netMovement,
        closingQuantity: closing,
        currentOnHand,
        breakdown: mv.breakdown,
      };
    });

    return {
      data,
      movements: movementLines,
      summary: {
        totalProducts: data.length,
        totalOpening,
        totalIn,
        totalOut,
        totalNet,
        totalClosing,
      },
    };
  }
}

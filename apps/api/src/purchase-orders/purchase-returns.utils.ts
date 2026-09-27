import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrderReturns,
  purchaseOrderReturnShipments,
  bins,
  binContents,
  zones,
  products as coreProducts,
} from '@herobm/db-schema';
import { sql, eq, and, inArray } from 'drizzle-orm';
import { BadRequestException } from '@nestjs/common';
import { getValuationStrategy } from '../inventory/valuation';
import type { InventoryMovementService } from '../inventory/inventory-movement.service';

export async function generateReturnNumber(db: DrizzleDB): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `PRT-${today}-`;

  const result = await db
    .select({ returnNumber: purchaseOrderReturns.returnNumber })
    .from(purchaseOrderReturns)
    .where(sql`${purchaseOrderReturns.returnNumber} LIKE ${prefix + '%'}`)
    .orderBy(sql`${purchaseOrderReturns.returnNumber} DESC`)
    .limit(1);

  const seq =
    result.length > 0
      ? parseInt(result[0].returnNumber.replace(prefix, ''), 10) + 1
      : 1;

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export async function generateShipmentNumber(db: DrizzleDB): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `RSH-${today}-`;

  const result = await db
    .select({ shipmentNumber: purchaseOrderReturnShipments.shipmentNumber })
    .from(purchaseOrderReturnShipments)
    .where(
      sql`${purchaseOrderReturnShipments.shipmentNumber} LIKE ${prefix + '%'}`,
    )
    .orderBy(sql`${purchaseOrderReturnShipments.shipmentNumber} DESC`)
    .limit(1);

  const seq =
    result.length > 0
      ? parseInt(result[0].shipmentNumber.replace(prefix, ''), 10) + 1
      : 1;

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export async function getSupplierReturnsBinId(
  tx: DrizzleDB,
  deliveryLocationId: string,
): Promise<string> {
  const [supplierReturnsBin] = await tx
    .select({ binId: bins.binId })
    .from(bins)
    .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
    .where(
      and(
        eq(bins.binNumber, 'SUPPLIER_RETURNS'),
        eq(zones.locationId, deliveryLocationId),
      ),
    )
    .limit(1);

  if (!supplierReturnsBin) {
    throw new BadRequestException(
      `SUPPLIER_RETURNS bin not found for location '${deliveryLocationId}'`,
    );
  }

  return supplierReturnsBin.binId;
}

export async function recalculateShipReturnWac(
  tx: DrizzleDB,
  moveLines: { productId: string; quantity: number; unitCost?: string }[],
  valuationMethodCode: string,
): Promise<void> {
  const productIds = [...new Set(moveLines.map((l) => l.productId))];
  if (productIds.length === 0) return;

  const productRows = await tx
    .select({
      productId: coreProducts.productId,
      standardCost: coreProducts.standardCost,
      weightedAverageCost: coreProducts.weightedAverageCost,
      qoh: sql<number>`COALESCE((SELECT SUM(${binContents.actualQuantity}::numeric) FROM ${binContents} WHERE ${binContents.productId} = ${coreProducts.productId}), 0)`.mapWith(
        Number,
      ),
    })
    .from(coreProducts)
    .where(inArray(coreProducts.productId, productIds));

  const productMap = new Map(productRows.map((p) => [p.productId, p]));
  const valuationStrategy = getValuationStrategy(valuationMethodCode);

  for (const line of moveLines) {
    const product = productMap.get(line.productId);
    if (!product) continue;

    const qty = Math.abs(line.quantity);
    const unitCost =
      line.unitCost ||
      product.weightedAverageCost ||
      product.standardCost ||
      '0';

    const productData = {
      ...product,
      standardCost: product.standardCost || '0',
      weightedAverageCost: product.weightedAverageCost || '0',
    };

    const valuation = valuationStrategy.onGoodsReceiptReversal(
      productData,
      product.qoh,
      qty,
      unitCost,
    );

    await tx
      .update(coreProducts)
      .set({ weightedAverageCost: valuation.newWeightedAverageCost })
      .where(eq(coreProducts.productId, product.productId));

    product.qoh -= qty;
    product.weightedAverageCost = valuation.newWeightedAverageCost;
  }
}

export async function recalculateUnshipReturnWac(
  tx: DrizzleDB,
  productId: string,
  qty: number,
  pricePerUnit: string | number | null | undefined,
  valuationMethodCode: string,
): Promise<void> {
  const productRows = await tx
    .select({
      productId: coreProducts.productId,
      standardCost: coreProducts.standardCost,
      weightedAverageCost: coreProducts.weightedAverageCost,
      qoh: sql<number>`COALESCE((SELECT SUM(${binContents.actualQuantity}::numeric) FROM ${binContents} WHERE ${binContents.productId} = ${coreProducts.productId}), 0)`.mapWith(
        Number,
      ),
    })
    .from(coreProducts)
    .where(eq(coreProducts.productId, productId));

  const product = productRows[0];
  if (!product) return;

  const valuationStrategy = getValuationStrategy(valuationMethodCode);
  const unitCost = pricePerUnit
    ? String(pricePerUnit)
    : product.weightedAverageCost || product.standardCost || '0';
  const productData = {
    ...product,
    standardCost: product.standardCost || '0',
    weightedAverageCost: product.weightedAverageCost || '0',
  };

  const valuation = valuationStrategy.onGoodsReceipt(
    productData,
    product.qoh,
    qty,
    unitCost,
  );

  await tx
    .update(coreProducts)
    .set({ weightedAverageCost: valuation.newWeightedAverageCost })
    .where(eq(coreProducts.productId, product.productId));
}

export async function executeStageReturnMovements(
  tx: DrizzleDB,
  returnLines: {
    returnLineId: string;
    purchaseOrderLineId: string;
    sourceBinId: string | null;
    quantityReturned: string;
  }[],
  orderLinesMap: Map<
    string,
    {
      productId?: string | null;
      unitOfMeasure?: string | null;
      [key: string]: unknown;
    }
  >,
  supplierReturnsBinId: string,
  returnId: string,
  actor: string,
  inventoryMovementService: InventoryMovementService,
): Promise<void> {
  for (const rl of returnLines) {
    if (!rl.sourceBinId) {
      throw new BadRequestException(
        `Source bin (sourceBinId) is required for return line '${rl.returnLineId}' before it can be staged.`,
      );
    }

    const orderLine = orderLinesMap.get(rl.purchaseOrderLineId);

    if (!orderLine || !orderLine.productId) {
      throw new BadRequestException(
        `Purchase order line not found for return line ${rl.returnLineId}`,
      );
    }

    const qty = parseFloat(rl.quantityReturned || '0');
    if (qty <= 0) {
      throw new BadRequestException(
        `Invalid quantity returned for return line ${rl.returnLineId}`,
      );
    }

    const movementNumber = `MOV-${Date.now()}`;
    await inventoryMovementService.recordInventoryMovement(tx, {
      entryNumber: movementNumber,
      sourceType: 'PURCHASE_RETURN_STAGE',
      sourceId: returnId,
      userId: actor,
      lines: [
        {
          productId: orderLine.productId,
          binId: rl.sourceBinId,
          quantity: -qty,
          uomCode: orderLine.unitOfMeasure || 'EA',
        },
        {
          productId: orderLine.productId,
          binId: supplierReturnsBinId,
          quantity: qty,
          uomCode: orderLine.unitOfMeasure || 'EA',
        },
      ],
    });
  }
}

export async function executeUnstageReturnMovements(
  tx: DrizzleDB,
  returnLines: {
    returnLineId: string;
    purchaseOrderLineId: string;
    sourceBinId: string | null;
    quantityReturned: string;
  }[],
  orderLinesMap: Map<
    string,
    {
      productId?: string | null;
      unitOfMeasure?: string | null;
      [key: string]: unknown;
    }
  >,
  supplierReturnsBinId: string,
  returnId: string,
  actor: string,
  inventoryMovementService: InventoryMovementService,
): Promise<void> {
  for (const rl of returnLines) {
    const orderLine = orderLinesMap.get(rl.purchaseOrderLineId);

    if (!orderLine || !orderLine.productId) {
      throw new BadRequestException(
        `Purchase order line not found for return line ${rl.returnLineId}`,
      );
    }

    if (!rl.sourceBinId) {
      throw new BadRequestException(
        `Source bin not found for return line ${rl.returnLineId}`,
      );
    }

    const qty = parseFloat(rl.quantityReturned || '0');
    if (qty <= 0) {
      throw new BadRequestException(
        `Invalid quantity returned for return line ${rl.returnLineId}`,
      );
    }

    const movementNumber = `MOV-${Date.now()}`;
    await inventoryMovementService.recordInventoryMovement(tx, {
      entryNumber: movementNumber,
      sourceType: 'PURCHASE_RETURN_UNSTAGE',
      sourceId: returnId,
      userId: actor,
      lines: [
        {
          productId: orderLine.productId,
          binId: supplierReturnsBinId,
          quantity: -qty,
          uomCode: orderLine.unitOfMeasure || 'EA',
        },
        {
          productId: orderLine.productId,
          binId: rl.sourceBinId,
          quantity: qty,
          uomCode: orderLine.unitOfMeasure || 'EA',
        },
      ],
    });
  }
}

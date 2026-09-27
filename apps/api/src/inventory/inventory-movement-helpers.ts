import { inArray, eq, and, sql, lte } from 'drizzle-orm';
import { BadRequestException } from '@nestjs/common';
import { products, bins, binContents, zones } from '@herobm/db-schema';
import { BIN_TYPE } from '@herobm/shared';
import { UomService } from './uom.service';
import { GlService } from '../gl/gl.service';
import { AppConfigService } from '../settings/app-config.service';
import { getValuationStrategy } from './valuation';
import { getAccountingStrategy } from './inventory-accounting';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import Decimal from 'decimal.js';

export interface MovementLineInput {
  productId: string;
  binId: string;
  quantity: number;
  uomCode?: string | null;
  unitCost?: number | string | null;
  totalValue?: number | string | null;
  originalQuantity?: number | null;
}

export interface ProcessedMovementLine extends MovementLineInput {
  uomCode: string;
  absoluteQuantity: number;
  originalQuantity: number;
  unitCost: string;
  totalValue: string;
}

export interface ResolvedBinInfo {
  binId: string;
  binNumber: string;
  binType: BIN_TYPE;
  locationId: string | null;
  zoneId: string | null;
}

/**
 * Pre-fetches product metadata, resolves packaging UOM to absolute base quantity,
 * and snapshots point-in-time unit cost and total line value (ADV-INV-002).
 */
export async function prepareMovementLines(
  tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0] | DrizzleDB,
  lines: MovementLineInput[],
  uomService: UomService,
): Promise<ProcessedMovementLine[]> {
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const productRows =
    productIds.length > 0
      ? await tx
          .select({
            productId: products.productId,
            baseUom: products.baseUom,
            standardCost: products.standardCost,
            weightedAverageCost: products.weightedAverageCost,
          })
          .from(products)
          .where(inArray(products.productId, productIds))
      : [];

  const productMap = new Map(productRows.map((p) => [p.productId, p]));
  const processedLines: ProcessedMovementLine[] = [];

  for (const line of lines) {
    const prod = productMap.get(line.productId);
    const effectiveUomCode = line.uomCode || prod?.baseUom || 'EA';
    const absoluteQty = await uomService.calculateAbsoluteBaseQuantity(
      line.productId,
      [{ quantity: line.quantity, uomCode: effectiveUomCode }],
      tx,
    );

    const origQty =
      line.originalQuantity !== undefined && line.originalQuantity !== null
        ? line.originalQuantity
        : line.quantity;

    const unitCostStr =
      line.unitCost !== undefined && line.unitCost !== null
        ? String(line.unitCost)
        : prod?.weightedAverageCost || prod?.standardCost || '0';

    const totalValStr =
      line.totalValue !== undefined && line.totalValue !== null
        ? String(line.totalValue)
        : new Decimal(absoluteQty).mul(new Decimal(unitCostStr)).toFixed(4);

    processedLines.push({
      ...line,
      uomCode: effectiveUomCode,
      absoluteQuantity: absoluteQty,
      originalQuantity: origQty,
      unitCost: unitCostStr,
      totalValue: totalValStr,
    });
  }

  return processedLines;
}

/**
 * Resolves location and zone context for all involved bins.
 */
export async function resolveBinsContext(
  tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0] | DrizzleDB,
  binIds: string[],
): Promise<Map<string, ResolvedBinInfo>> {
  const uniqueBinIds = [...new Set(binIds)];
  const resolvedBins = await tx
    .select()
    .from(bins)
    .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
    .where(inArray(bins.binId, uniqueBinIds));

  return new Map(
    resolvedBins.map((row) => [
      row.bins.binId,
      {
        ...row.bins,
        locationId: row.zones.locationId,
        binType: row.bins.binType as BIN_TYPE,
      },
    ]),
  );
}

/**
 * Validates stock availability if negative inventory is disallowed.
 */
export async function validateNegativeInventory(
  tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0] | DrizzleDB,
  processedLines: ProcessedMovementLine[],
  binMap: Map<string, ResolvedBinInfo>,
): Promise<void> {
  const deductions = new Map<
    string,
    { binId: string; productId: string; totalDeduction: number }
  >();

  for (const line of processedLines) {
    if (line.absoluteQuantity < 0) {
      const b = binMap.get(line.binId);
      if (
        b?.binType === BIN_TYPE.WIP ||
        b?.binType === BIN_TYPE.IN_TRANSIT ||
        b?.binType === BIN_TYPE.STAGING
      ) {
        continue;
      }
      const key = `${line.binId}:${line.productId}`;
      const existing = deductions.get(key);
      const totalDeduction = new Decimal(existing?.totalDeduction || 0)
        .plus(new Decimal(Math.abs(line.absoluteQuantity)))
        .toNumber();
      deductions.set(key, {
        binId: line.binId,
        productId: line.productId,
        totalDeduction,
      });
    }
  }

  if (deductions.size > 0) {
    const deductionBinIds = [
      ...new Set([...deductions.values()].map((d) => d.binId)),
    ];
    const currentStocks = await tx
      .select({
        binId: binContents.binId,
        productId: binContents.productId,
        actualQuantity: binContents.actualQuantity,
      })
      .from(binContents)
      .where(inArray(binContents.binId, deductionBinIds));

    const stockMap = new Map<string, number>();
    for (const s of currentStocks) {
      stockMap.set(
        `${s.binId}:${s.productId}`,
        new Decimal(s.actualQuantity || 0).toNumber(),
      );
    }

    for (const { binId, productId, totalDeduction } of deductions.values()) {
      const availableQty = stockMap.get(`${binId}:${productId}`) || 0;
      if (availableQty < totalDeduction) {
        const b = binMap.get(binId);
        throw new BadRequestException(
          `Insufficient stock in bin ${b?.binNumber || binId} for product ${productId}. Available: ${availableQty}, Requested: ${totalDeduction}`,
        );
      }
    }
  }
}

/**
 * Handles financial ledger posting for manual inventory adjustments / shrinkage.
 */
export async function handleAdjustmentFinancials(
  tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0] | DrizzleDB,
  processedLines: ProcessedMovementLine[],
  params: { entryNumber: string; memo?: string; userId?: string },
  entryId: string,
  appConfig: AppConfigService,
  glService: GlService,
): Promise<void> {
  const productIds = [...new Set(processedLines.map((l) => l.productId))];
  if (productIds.length === 0) return;

  const productRows = await tx
    .select({
      productId: products.productId,
      standardCost: products.standardCost,
      weightedAverageCost: products.weightedAverageCost,
    })
    .from(products)
    .where(inArray(products.productId, productIds));

  const productMap = new Map(productRows.map((p) => [p.productId, p]));
  const valuationStrategy = getValuationStrategy(appConfig.valuationMethod());

  let totalShrinkageValue = new Decimal(0);
  for (const line of processedLines) {
    const p = productMap.get(line.productId);
    if (p) {
      const cost = valuationStrategy.getCogs(
        {
          productId: p.productId,
          standardCost: p.standardCost || '0',
          weightedAverageCost: p.weightedAverageCost || '0',
        },
        Math.abs(line.absoluteQuantity),
      );

      if (line.absoluteQuantity > 0) {
        totalShrinkageValue = totalShrinkageValue.minus(
          new Decimal(cost || '0'),
        );
      } else if (line.absoluteQuantity < 0) {
        totalShrinkageValue = totalShrinkageValue.plus(
          new Decimal(cost || '0'),
        );
      }
    }
  }

  if (totalShrinkageValue.abs().gt(0.001)) {
    const accountingStrategy = getAccountingStrategy(
      appConfig.inventoryAccountingMode(),
      {
        inventoryAccountId: appConfig.defaultInventoryAccountId(),
        grniAccountId: appConfig.defaultGrniAccountId(),
        cogsAccountId: appConfig.defaultCogsAccountId(),
        shrinkageAccountId: appConfig.defaultShrinkageAccountId(),
        ppvAccountId: appConfig.defaultPpvAccountId(),
      },
    );

    const direction = totalShrinkageValue.gt(0) ? 'loss' : 'gain';
    const adjustmentGl = accountingStrategy.onManualAdjustment(
      {
        amount: totalShrinkageValue
          .abs()
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber(),
        memo: `Manual Adjustment ${params.entryNumber}`,
      },
      direction,
    );

    if (adjustmentGl) {
      await glService.postJournalEntry(
        adjustmentGl.lines as Parameters<GlService['postJournalEntry']>[0],
        {
          actor: params.userId || 'system',
          entryDate: new Date().toISOString().slice(0, 10),
          sourceType: adjustmentGl.sourceType,
          sourceId: entryId,
          memo: params.memo || `Inventory Adjustment ${params.entryNumber}`,
        },
        tx,
      );
    }
  }
}

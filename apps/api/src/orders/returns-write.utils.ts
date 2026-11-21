import {
  products as coreProducts,
  salesOrderReturnLines,
  salesOrderReturns,
} from '@herobm/db-schema';
import { RETURN_STATE, resolveProductUnitCost } from '@herobm/shared';
import Decimal from 'decimal.js';
import { and, eq, sql } from 'drizzle-orm';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import type { ValuationStrategy } from '../inventory/valuation';

export async function generateReturnNumber(db: DrizzleDB): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `RET-${today}-`;
  const result = await db
    .select({ returnNumber: salesOrderReturns.returnNumber })
    .from(salesOrderReturns)
    .where(sql`${salesOrderReturns.returnNumber} LIKE ${prefix + '%'}`)
    .orderBy(sql`${salesOrderReturns.returnNumber} DESC`)
    .limit(1);
  const seq =
    result.length > 0
      ? parseInt(result[0].returnNumber.replace(prefix, ''), 10) + 1
      : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export async function getAlreadyReturnedQty(
  db: DrizzleDB,
  salesOrderLineId: string,
  excludeReturnId?: string,
): Promise<number> {
  const query = db
    .select({
      total: sql<string>`COALESCE(SUM(${salesOrderReturnLines.quantityReturned}::numeric), 0)::text`,
    })
    .from(salesOrderReturnLines)
    .innerJoin(
      salesOrderReturns,
      eq(salesOrderReturnLines.returnId, salesOrderReturns.returnId),
    )
    .where(
      and(
        eq(salesOrderReturnLines.salesOrderLineId, salesOrderLineId),
        sql`${salesOrderReturns.stateCode} != ${RETURN_STATE.CANCELLED}`,
        excludeReturnId
          ? sql`${salesOrderReturns.returnId} != ${excludeReturnId}`
          : undefined,
      ),
    );

  const rows = await query;
  return new Decimal(rows[0]?.total ?? '0').toNumber();
}

export async function recalculateSalesReturnWac(
  innerTx: DrizzleDB,
  stockLines: { productId: string; quantity: number; unitCost?: string }[],
  productMap: Map<
    string,
    {
      productId: string;
      standardCost: string | null;
      weightedAverageCost: string | null;
      qoh: number;
    }
  >,
  valuationStrategy: ValuationStrategy,
): Promise<void> {
  for (const line of stockLines) {
    const product = productMap.get(line.productId);
    if (!product) continue;

    const unitCost = line.unitCost || resolveProductUnitCost(product);
    const productData = {
      ...product,
      standardCost: product.standardCost || '0',
      weightedAverageCost: product.weightedAverageCost || '0',
    };

    const valuation = valuationStrategy.onGoodsReceipt(
      productData,
      product.qoh,
      line.quantity,
      unitCost,
    );

    await innerTx
      .update(coreProducts)
      .set({ weightedAverageCost: valuation.newWeightedAverageCost })
      .where(eq(coreProducts.productId, product.productId));

    product.qoh += line.quantity;
    product.weightedAverageCost = valuation.newWeightedAverageCost;
  }
}

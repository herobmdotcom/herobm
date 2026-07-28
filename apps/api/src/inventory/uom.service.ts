import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { products, productUoms } from '../drizzle/schema';

export interface UomInputLine {
  uomCode?: string;
  quantity: number;
}

@Injectable()
export class UomService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  /**
   * Centralized utility to calculate total absolute base quantities
   * for a given product across a mixture of entered UOMs.
   *
   * Example: 5 BOX (ratio 25) + 2 EA (ratio 1) = 127 Base Units.
   * If a uomCode is not provided, or matches the product's baseUom, the ratio is 1.
   */
  async calculateAbsoluteBaseQuantity(
    productId: string,
    lines: UomInputLine[],
    txClient?:
      | Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]
      | DrizzleDB,
  ): Promise<number> {
    const dbClient = txClient || this.db;

    if (lines.length === 0) return 0;

    // Fetch the product to know its base UOM
    const [product] = await dbClient
      .select({
        productId: products.productId,
        baseUom: products.baseUom,
      })
      .from(products)
      .where(eq(products.productId, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    // Identify which defined UOMs we actually need to look up
    const requestedUoms = new Set<string>();
    for (const line of lines) {
      if (line.uomCode && line.uomCode !== product.baseUom) {
        requestedUoms.add(line.uomCode);
      }
    }

    // Fetch required conversion ratios
    const ratioMap = new Map<string, number>();
    if (requestedUoms.size > 0) {
      const uomRows = await dbClient
        .select({
          uomCode: productUoms.uomCode,
          ratio: productUoms.ratio,
        })
        .from(productUoms)
        .where(eq(productUoms.productId, productId));

      for (const row of uomRows) {
        ratioMap.set(row.uomCode, parseFloat(row.ratio));
      }
    }

    let absoluteTotal = 0;

    // Do the centralized math
    for (const line of lines) {
      const uom = line.uomCode || product.baseUom;

      if (uom === product.baseUom) {
        absoluteTotal += line.quantity;
      } else {
        const ratio = ratioMap.get(uom);
        if (ratio === undefined) {
          throw new Error(
            `UOM '${uom}' is not configured for product ${productId}.`,
          );
        }
        absoluteTotal += line.quantity * ratio;
      }
    }

    return absoluteTotal;
  }
}

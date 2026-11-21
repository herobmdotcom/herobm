import {
  suppliers as coreSuppliers,
  locations,
  organizations,
  products,
  purchaseOrderLineItems,
  supplierExpiries,
} from '@herobm/db-schema';
import {
  LineType,
  ORGANIZATION_STATE,
  PRODUCT_STATE,
  computeLinePriceForStorage,
} from '@herobm/shared';
import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { CreatePurchaseOrderLineDto } from './dto';
import { buildCreatePoLineRecord } from './purchase-orders-helpers.utils';

export type ResolvePoLineTaxFn = (
  tx: DrizzleDB,
  vendorId: string,
  productId?: string,
  taxCategoryIdOverride?: string,
) => Promise<{ taxCategoryId: string | null; rate: number }>;

/**
 * Validate delivery location, active supplier status, and supplier compliance expiries
 * before creating a purchase order. Read-only.
 */
export async function validatePoCreatePreconditions(
  tx: DrizzleDB,
  deliveryLocationId: string | undefined,
  vendorId: string,
): Promise<void> {
  if (!deliveryLocationId) {
    throw new BadRequestException(
      'Delivery location is mandatory for all purchase orders.',
    );
  }

  const [loc] = await tx
    .select()
    .from(locations)
    .where(eq(locations.locationId, deliveryLocationId))
    .limit(1);

  if (!loc) {
    throw new BadRequestException('Invalid delivery location ID.');
  }

  const [supplier] = await tx
    .select({ stateCode: organizations.stateCode })
    .from(coreSuppliers)
    .leftJoin(
      organizations,
      eq(coreSuppliers.organizationId, organizations.organizationId),
    )
    .where(eq(coreSuppliers.vendorId, vendorId))
    .limit(1);

  if (!supplier) {
    throw new BadRequestException('Supplier not found.');
  }
  if (supplier.stateCode !== ORGANIZATION_STATE.ACTIVE) {
    throw new BadRequestException(
      'Cannot create purchase order for an inactive supplier.',
    );
  }

  const expiredDocs = await tx
    .select({ id: supplierExpiries.expiryId })
    .from(supplierExpiries)
    .where(
      and(
        eq(supplierExpiries.vendorId, vendorId),
        sql`${supplierExpiries.expiryDate} < CURRENT_DATE`,
      ),
    )
    .limit(1);

  if (expiredDocs.length > 0) {
    throw new BadRequestException(
      'Supplier has expired compliance documentation. Cannot create purchase order.',
    );
  }
}

/**
 * Validate products, resolve tax, check discount bounds, and build insert records
 * for purchase order creation lines. Read-only.
 */
export async function buildValidatedCreatePoLineRecords(
  tx: DrizzleDB,
  purchaseOrderId: string,
  vendorId: string,
  lines: (CreatePurchaseOrderLineDto & { lineType?: string })[],
  resolveTaxForLine: ResolvePoLineTaxFn,
): Promise<(typeof purchaseOrderLineItems.$inferInsert)[]> {
  const productIdsToValidate: string[] = [];
  for (const l of lines) {
    if (
      l.lineType !== LineType.COMMENT &&
      l.productId &&
      l.productId !== '00000000-0000-4000-8000-000000000000' &&
      !productIdsToValidate.includes(l.productId)
    ) {
      productIdsToValidate.push(l.productId);
    }
  }

  const productRows =
    productIdsToValidate.length > 0
      ? await tx
          .select({
            productId: products.productId,
            stateCode: products.stateCode,
          })
          .from(products)
          .where(inArray(products.productId, productIdsToValidate))
      : [];

  const productMap = new Map(productRows.map((p) => [p.productId, p]));
  const lineValues: (typeof purchaseOrderLineItems.$inferInsert)[] = [];

  let index = 0;
  for (const line of lines) {
    const isComment = line.lineType === LineType.COMMENT;
    const isCustom = line.productId === '00000000-0000-4000-8000-000000000000';
    if (!isComment && !isCustom && line.productId) {
      const product = productMap.get(line.productId);
      if (!product) {
        throw new BadRequestException(`Product '${line.productId}' not found.`);
      }
      if (product.stateCode !== PRODUCT_STATE.ACTIVE) {
        throw new BadRequestException(
          `Cannot use product '${line.productId}' as it is not active.`,
        );
      }
    }

    let taxCategoryId: string | null = null;
    let rate = 0;
    if (!isComment) {
      const resolved = await resolveTaxForLine(
        tx,
        vendorId,
        line.productId,
        line.taxCategoryId,
      );
      taxCategoryId = resolved.taxCategoryId;
      rate = resolved.rate;
      const disc = parseFloat(line.discountPercentage || '0');
      if (isNaN(disc) || disc < 0 || disc > 100) {
        throw new BadRequestException(
          `Line ${index + 1}: Discount percentage must be between 0 and 100`,
        );
      }
    }

    lineValues.push(
      buildCreatePoLineRecord(
        purchaseOrderId,
        index,
        line,
        rate,
        taxCategoryId,
      ),
    );
    index++;
  }

  return lineValues;
}

/**
 * Build replacement line insert records for purchase order update. Read-only.
 */
export async function buildUpdatePoLineRecords(
  tx: DrizzleDB,
  purchaseOrderId: string,
  vendorId: string,
  lines: (CreatePurchaseOrderLineDto & { lineType?: string })[],
  resolveTaxForLine: ResolvePoLineTaxFn,
): Promise<(typeof purchaseOrderLineItems.$inferInsert)[]> {
  const lineValues: (typeof purchaseOrderLineItems.$inferInsert)[] = [];
  let index = 0;
  for (const line of lines) {
    const qty = new Decimal(line.quantity || '0').toNumber();
    const price = new Decimal(line.pricePerUnit || '0').toNumber();
    const disc = new Decimal(line.discountPercentage || '0').toNumber();
    const { taxCategoryId, rate } = await resolveTaxForLine(
      tx,
      vendorId,
      line.productId,
      line.taxCategoryId,
    );
    const pricing = computeLinePriceForStorage({
      quantity: qty,
      pricePerUnit: price,
      discountPercentage: disc,
      taxRate: rate,
    });
    lineValues.push({
      purchaseOrderId,
      lineNumber: index + 1,
      productId: line.productId,
      productDescription: line.productDescription,
      quantity: String(line.quantity || '0'),
      pricePerUnit: String(line.pricePerUnit || '0'),
      unitOfMeasure: line.unitOfMeasure || 'EA',
      amount: pricing.amount,
      tax: pricing.tax,
      totalAmount: pricing.totalAmount,
      taxCategoryId,
    });
    index++;
  }
  return lineValues;
}

/**
 * Pure helper to merge a requested line ID ordering with all existing PO line IDs.
 */
export function computeReorderedPoLineIds(
  existingLines: { purchaseOrderLineId: string }[],
  requestedLineIds: string[],
): string[] {
  const validIds = new Set(existingLines.map((l) => l.purchaseOrderLineId));
  const orderedIds: string[] = [];
  const visited = new Set<string>();

  for (const id of requestedLineIds) {
    if (validIds.has(id) && !visited.has(id)) {
      visited.add(id);
      orderedIds.push(id);
    }
  }
  for (const l of existingLines) {
    if (!visited.has(l.purchaseOrderLineId)) {
      visited.add(l.purchaseOrderLineId);
      orderedIds.push(l.purchaseOrderLineId);
    }
  }
  return orderedIds;
}

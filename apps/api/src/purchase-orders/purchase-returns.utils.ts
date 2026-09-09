import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrderReturns,
  purchaseOrderReturnShipments,
  bins,
  zones,
} from '@herobm/db-schema';
import { sql, eq, and } from 'drizzle-orm';
import { BadRequestException } from '@nestjs/common';

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

import { salesOrderLineItems } from '@herobm/db-schema';
import { and, asc, eq, gte, lt, sql } from 'drizzle-orm';
import type { DrizzleDB } from '../drizzle/drizzle.module';

/**
 * Shift existing sales order lines at or after `requestedLine` downward by `shiftCount`
 * using a two-step negative shift to avoid `unique_so_line_number` collisions during UPDATE.
 */
export async function shiftOrderLinesForInsert(
  tx: DrizzleDB,
  orderId: string,
  requestedLine: number,
  shiftCount: number,
): Promise<void> {
  await tx
    .update(salesOrderLineItems)
    .set({
      lineNumber: sql`-(${salesOrderLineItems.lineNumber} + ${shiftCount})`,
    })
    .where(
      and(
        eq(salesOrderLineItems.salesOrderId, orderId),
        gte(salesOrderLineItems.lineNumber, requestedLine),
      ),
    );
  await tx
    .update(salesOrderLineItems)
    .set({
      lineNumber: sql`-${salesOrderLineItems.lineNumber}`,
    })
    .where(
      and(
        eq(salesOrderLineItems.salesOrderId, orderId),
        lt(salesOrderLineItems.lineNumber, 0),
      ),
    );
}

/**
 * Reorder top-level sales order lines (keeping kit component child lines grouped
 * immediately after their parent) using a two-step negative shift to avoid
 * `unique_so_line_number` collisions.
 *
 * Returns the final ordered line IDs, or `null` if there are 1 or fewer lines.
 */
export async function reorderSalesOrderLines(
  tx: DrizzleDB,
  orderId: string,
  lineIds: string[],
): Promise<string[] | null> {
  const existingLines = await tx
    .select({
      salesOrderLineId: salesOrderLineItems.salesOrderLineId,
      parentLineId: salesOrderLineItems.parentLineId,
      lineNumber: salesOrderLineItems.lineNumber,
    })
    .from(salesOrderLineItems)
    .where(eq(salesOrderLineItems.salesOrderId, orderId))
    .orderBy(asc(salesOrderLineItems.lineNumber));

  if (existingLines.length <= 1) return null;

  const lineMap = new Map(existingLines.map((l) => [l.salesOrderLineId, l]));
  const childrenByParent = new Map<string, typeof existingLines>();
  for (const l of existingLines) {
    if (l.parentLineId) {
      const list = childrenByParent.get(l.parentLineId) || [];
      list.push(l);
      childrenByParent.set(l.parentLineId, list);
    }
  }

  const orderedIds: string[] = [];
  const visited = new Set<string>();

  const appendWithChildren = (lineId: string) => {
    if (visited.has(lineId)) return;
    const line = lineMap.get(lineId);
    if (!line || line.parentLineId) return;
    visited.add(lineId);
    orderedIds.push(lineId);
    const children = childrenByParent.get(lineId) || [];
    for (const child of children) {
      if (!visited.has(child.salesOrderLineId)) {
        visited.add(child.salesOrderLineId);
        orderedIds.push(child.salesOrderLineId);
      }
    }
  };

  for (const id of lineIds) {
    appendWithChildren(id);
  }
  for (const l of existingLines) {
    if (!visited.has(l.salesOrderLineId)) {
      visited.add(l.salesOrderLineId);
      orderedIds.push(l.salesOrderLineId);
    }
  }

  // Two-step negative shift to avoid unique_so_line_number collisions
  await tx
    .update(salesOrderLineItems)
    .set({ lineNumber: sql`-${salesOrderLineItems.lineNumber}` })
    .where(eq(salesOrderLineItems.salesOrderId, orderId));

  for (let i = 0; i < orderedIds.length; i++) {
    await tx
      .update(salesOrderLineItems)
      .set({ lineNumber: i + 1 })
      .where(
        and(
          eq(salesOrderLineItems.salesOrderId, orderId),
          eq(salesOrderLineItems.salesOrderLineId, orderedIds[i]),
        ),
      );
  }

  return orderedIds;
}

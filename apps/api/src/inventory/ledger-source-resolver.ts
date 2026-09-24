import { aliasedTable, eq } from 'drizzle-orm';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderShipments,
  salesOrderReturns,
  customers,
  organizations,
  locations,
  transferOrders,
  goodsReceived,
  goodsReceivedLines,
  purchaseOrders,
  suppliers,
  workOrders,
} from '@herobm/db-schema';

export interface LedgerRelatedEntities {
  relatedDocument: { number: string; link?: string } | null;
  relatedParty: { name: string; number: string; link?: string } | null;
}

/**
 * Resolves the related document and party information for a given inventory entry source.
 */
export async function resolveLedgerRelatedEntities(
  db: DrizzleDB,
  sourceType: string | null | undefined,
  sourceId: string | null | undefined,
): Promise<LedgerRelatedEntities> {
  let relatedDocument: { number: string; link?: string } | null = null;
  let relatedParty: { name: string; number: string; link?: string } | null =
    null;

  if (!sourceId || !sourceType) {
    return { relatedDocument, relatedParty };
  }

  if (sourceType === 'SO_PICK') {
    const [o] = await db
      .select({
        salesOrderId: salesOrders.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        customerId: customers.customerId,
        customerName: organizations.name,
        customerNumber: customers.customerNumber,
      })
      .from(salesOrders)
      .leftJoin(customers, eq(salesOrders.customerId, customers.customerId))
      .leftJoin(
        organizations,
        eq(customers.organizationId, organizations.organizationId),
      )
      .where(eq(salesOrders.salesOrderId, sourceId))
      .limit(1);

    if (o) {
      relatedDocument = {
        number: o.orderNumber,
        link: `/sales-orders/${o.salesOrderId}#picking-section`,
      };
      relatedParty = o.customerName
        ? {
            name: o.customerName,
            number: o.customerNumber || '',
            link: `/customers/${o.customerId}`,
          }
        : null;
    }
  } else if (sourceType === 'SO_SHIPMENT') {
    const [s] = await db
      .select({
        shipmentNumber: salesOrderShipments.shipmentNumber,
        salesOrderId: salesOrders.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        customerId: customers.customerId,
        customerName: organizations.name,
        customerNumber: customers.customerNumber,
      })
      .from(salesOrderShipments)
      .innerJoin(
        salesOrders,
        eq(salesOrders.salesOrderId, salesOrderShipments.salesOrderId),
      )
      .leftJoin(customers, eq(salesOrders.customerId, customers.customerId))
      .leftJoin(
        organizations,
        eq(customers.organizationId, organizations.organizationId),
      )
      .where(eq(salesOrderShipments.shipmentId, sourceId))
      .limit(1);

    if (s) {
      relatedDocument = {
        number: s.orderNumber,
        link: `/sales-orders/${s.salesOrderId}#shipments-section`,
      };
      relatedParty = s.customerName
        ? {
            name: s.customerName,
            number: s.customerNumber || '',
            link: `/customers/${s.customerId}`,
          }
        : null;
    }
  } else if (sourceType === 'SO_RETURN') {
    const [ret] = await db
      .select({
        returnNumber: salesOrderReturns.returnNumber,
        salesOrderId: salesOrders.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        customerId: customers.customerId,
        customerName: organizations.name,
        customerNumber: customers.customerNumber,
      })
      .from(salesOrderReturns)
      .innerJoin(
        salesOrders,
        eq(salesOrders.salesOrderId, salesOrderReturns.salesOrderId),
      )
      .leftJoin(customers, eq(salesOrders.customerId, customers.customerId))
      .leftJoin(
        organizations,
        eq(customers.organizationId, organizations.organizationId),
      )
      .where(eq(salesOrderReturns.returnId, sourceId))
      .limit(1);

    if (ret) {
      relatedDocument = {
        number: ret.orderNumber,
        link: `/sales-orders/${ret.salesOrderId}#returns-section`,
      };
      relatedParty = ret.customerName
        ? {
            name: ret.customerName,
            number: ret.customerNumber || '',
            link: `/customers/${ret.customerId}`,
          }
        : null;
    }
  } else if (
    sourceType === 'TO_DISPATCH' ||
    sourceType === 'TO_RECEIPT' ||
    sourceType === 'TRANSFER' ||
    sourceType === 'TRANSFER_ORDER' ||
    sourceType === 'TRANSFER_DISPATCH' ||
    sourceType === 'TRANSFER_RECEIPT'
  ) {
    const sourceLoc = aliasedTable(locations, 'to_source_loc');
    const destLoc = aliasedTable(locations, 'to_dest_loc');

    const [to] = await db
      .select({
        transferOrderId: transferOrders.transferOrderId,
        orderNumber: transferOrders.orderNumber,
        sourceLocationId: transferOrders.sourceLocationId,
        sourceLocationName: sourceLoc.name,
        sourceLocationCode: sourceLoc.code,
        destLocationId: transferOrders.destinationLocationId,
        destLocationName: destLoc.name,
        destLocationCode: destLoc.code,
      })
      .from(transferOrders)
      .leftJoin(
        sourceLoc,
        eq(transferOrders.sourceLocationId, sourceLoc.locationId),
      )
      .leftJoin(
        destLoc,
        eq(transferOrders.destinationLocationId, destLoc.locationId),
      )
      .where(eq(transferOrders.transferOrderId, sourceId))
      .limit(1);

    if (to) {
      relatedDocument = {
        number: to.orderNumber,
        link: `/inventory/transfers/${to.transferOrderId}`,
      };
      relatedParty = {
        name: `${to.sourceLocationCode} (${to.sourceLocationName}) → ${to.destLocationCode} (${to.destLocationName})`,
        number: `${to.sourceLocationCode} → ${to.destLocationCode}`,
        link: `/inventory/transfers/${to.transferOrderId}`,
      };
    }
  } else if (
    sourceType === 'PO_RECEIPT' ||
    sourceType === 'GOODS_RECEIPT' ||
    sourceType === 'PURCHASE_RECEIPT'
  ) {
    const [gr] = await db
      .select({
        receiptNumber: goodsReceived.receiptNumber,
        vendorId: suppliers.vendorId,
        vendorName: organizations.name,
        vendorNumber: suppliers.vendorNumber,
      })
      .from(goodsReceived)
      .leftJoin(suppliers, eq(goodsReceived.vendorId, suppliers.vendorId))
      .leftJoin(
        organizations,
        eq(suppliers.organizationId, organizations.organizationId),
      )
      .where(eq(goodsReceived.goodsReceivedId, sourceId))
      .limit(1);

    if (gr) {
      const [grLine] = await db
        .select({
          purchaseOrderId: goodsReceivedLines.purchaseOrderId,
          poNumber: purchaseOrders.orderNumber,
        })
        .from(goodsReceivedLines)
        .leftJoin(
          purchaseOrders,
          eq(
            goodsReceivedLines.purchaseOrderId,
            purchaseOrders.purchaseOrderId,
          ),
        )
        .where(eq(goodsReceivedLines.goodsReceivedId, sourceId))
        .limit(1);

      relatedDocument = {
        number: grLine?.poNumber || gr.receiptNumber,
        link: grLine?.purchaseOrderId
          ? `/purchase-orders/${grLine.purchaseOrderId}`
          : undefined,
      };
      relatedParty = gr.vendorName
        ? {
            name: gr.vendorName,
            number: gr.vendorNumber || '',
            link: `/suppliers/${gr.vendorId}`,
          }
        : null;
    } else {
      const [po] = await db
        .select({
          purchaseOrderId: purchaseOrders.purchaseOrderId,
          poNumber: purchaseOrders.orderNumber,
          vendorId: suppliers.vendorId,
          vendorName: organizations.name,
          vendorNumber: suppliers.vendorNumber,
        })
        .from(purchaseOrders)
        .leftJoin(suppliers, eq(purchaseOrders.vendorId, suppliers.vendorId))
        .leftJoin(
          organizations,
          eq(suppliers.organizationId, organizations.organizationId),
        )
        .where(eq(purchaseOrders.purchaseOrderId, sourceId))
        .limit(1);

      if (po) {
        relatedDocument = {
          number: po.poNumber,
          link: `/purchase-orders/${po.purchaseOrderId}`,
        };
        relatedParty = po.vendorName
          ? {
              name: po.vendorName,
              number: po.vendorNumber || '',
              link: `/suppliers/${po.vendorId}`,
            }
          : null;
      }
    }
  } else if (
    sourceType === 'WORK_ORDER' ||
    sourceType === 'WO_ISSUE' ||
    sourceType === 'WO_RECEIPT'
  ) {
    const [wo] = await db
      .select({
        workOrderId: workOrders.workOrderId,
        orderNumber: workOrders.orderNumber,
      })
      .from(workOrders)
      .where(eq(workOrders.workOrderId, sourceId))
      .limit(1);

    if (wo) {
      relatedDocument = {
        number: wo.orderNumber,
        link: `/work-orders/${wo.workOrderId}`,
      };
    }
  }

  return { relatedDocument, relatedParty };
}

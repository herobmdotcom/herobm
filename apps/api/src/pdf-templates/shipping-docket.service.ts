import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderShipments,
  salesOrderShipmentLines,
  salesOrderLineItems,
  products as coreProducts,
  customers as coreAccounts,
  actors,
} from '../drizzle/schema';

export interface ShippingDocketData {
  header: {
    shipmentNumber: string;
    orderNumber: string;
    customerName: string;
    customerAddress: string;
    trackingNumber: string;
    notes: string;
    dispatchDate: string;
  };
  lines: Array<{
    productCode: string;
    description: string;
    quantityShipped: number;
  }>;
  generatedAt: string;
}

@Injectable()
export class ShippingDocketService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  private readonly logger = new Logger(ShippingDocketService.name);

  async assembleData(shipmentId: string): Promise<ShippingDocketData> {
    const shipmentRows = await this.db
      .select({
        shipmentNumber: salesOrderShipments.shipmentNumber,
        trackingNumber: salesOrderShipments.trackingNumber,
        notes: salesOrderShipments.notes,
        createdOn: salesOrderShipments.createdOn,
        orderNumber: salesOrders.orderNumber,
        customerName: actors.name,
        customerAddress: actors.headquartersAddressLine1,
      })
      .from(salesOrderShipments)
      .innerJoin(
        salesOrders,
        eq(salesOrderShipments.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
      .where(eq(salesOrderShipments.shipmentId, shipmentId))
      .limit(1);

    if (shipmentRows.length === 0) {
      throw new NotFoundException(`Shipment '${shipmentId}' not found`);
    }
    const shipment = shipmentRows[0];

    const lines = await this.db
      .select({
        productCode: coreProducts.productNumber,
        description: salesOrderLineItems.productDescription,
        quantityShipped: salesOrderShipmentLines.quantityShipped,
      })
      .from(salesOrderShipmentLines)
      .innerJoin(
        salesOrderLineItems,
        eq(
          salesOrderShipmentLines.salesOrderLineId,
          salesOrderLineItems.salesOrderLineId,
        ),
      )
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .where(eq(salesOrderShipmentLines.shipmentId, shipmentId));

    const customerAddress = shipment.customerAddress || '—';

    return {
      header: {
        shipmentNumber: shipment.shipmentNumber,
        orderNumber: shipment.orderNumber ?? '',
        customerName: shipment.customerName ?? '',
        customerAddress,
        trackingNumber: shipment.trackingNumber ?? '—',
        notes: shipment.notes ?? '',
        dispatchDate: shipment.createdOn
          ? new Date(shipment.createdOn).toLocaleDateString('en-IE')
          : '',
      },
      lines: lines.map((l) => ({
        productCode: l.productCode ?? '',
        description: l.description ?? '',
        quantityShipped: parseFloat(l.quantityShipped ?? '0'),
      })),
      generatedAt:
        new Date().toLocaleDateString('en-IE') +
        ' ' +
        new Date().toLocaleTimeString('en-IE', {
          hour: '2-digit',
          minute: '2-digit',
        }),
    };
  }
}

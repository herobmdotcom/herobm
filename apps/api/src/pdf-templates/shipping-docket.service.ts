import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
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
  transferOrders,
  transferOrderShipments,
  transferOrderShipmentLines,
  transferOrderLines,
  locations,
} from '@herobm/db-schema';

export interface ShippingDocketData {
  header: {
    shipmentNumber: string;
    orderNumber: string;
    customerName: string;
    customerAddress: string;
    trackingNumber: string;
    notes: string;
    dispatchDate: string;
    deliveryName?: string;
    deliveryCompanyName?: string;
    deliveryPhone?: string;
    deliveryAddressLine1?: string;
    deliveryAddressLine2?: string;
    deliveryCity?: string;
    deliveryState?: string;
    deliveryPostalCode?: string;
    deliveryCountry?: string;
    shippingNotes?: string;
    customerOrderNumber?: string;
  };
  lines: Array<{
    productCode: string;
    description: string;
    quantityShipped: number;
  }>;
  totalQuantity?: number;
  totalLines?: number;
  _org?: Record<string, unknown>;
  customPdfText?: string;
  quoteIntroText?: string;
  generatedAt: string;
}

@Injectable()
export class ShippingDocketService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  private readonly logger = new Logger(ShippingDocketService.name);

  async assembleData(
    shipmentId: string,
    options?: Record<string, unknown>,
  ): Promise<ShippingDocketData> {
    const shipmentRows = await this.db
      .select({
        shipmentNumber: salesOrderShipments.shipmentNumber,
        trackingNumber: salesOrderShipments.trackingNumber,
        notes: salesOrderShipments.notes,
        createdOn: salesOrderShipments.createdOn,
        orderNumber: salesOrders.orderNumber,
        customerName: actors.name,
        customerAddress: actors.headquartersAddressLine1,
        deliveryName: salesOrders.deliveryName,
        deliveryCompanyName: salesOrders.deliveryCompanyName,
        deliveryPhone: salesOrders.deliveryPhone,
        deliveryAddressLine1: salesOrders.deliveryAddressLine1,
        deliveryAddressLine2: salesOrders.deliveryAddressLine2,
        deliveryCity: salesOrders.deliveryCity,
        deliveryState: salesOrders.deliveryState,
        deliveryPostalCode: salesOrders.deliveryPostalCode,
        deliveryCountry: salesOrders.deliveryCountry,
        shippingNotes: salesOrders.shippingNotes,
        customerOrderNumber: salesOrders.customerOrderNumber,
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
      const transferRows = await this.db
        .select({
          shipmentNumber: transferOrderShipments.shipmentNumber,
          trackingNumber: transferOrderShipments.trackingNumber,
          notes: transferOrders.notes,
          createdOn: transferOrderShipments.createdOn,
          orderNumber: transferOrders.orderNumber,
          customerName: locations.name,
          customerAddress: locations.addressLine1,
          deliveryName: locations.name,
          deliveryCompanyName: sql<string | null>`NULL`,
          deliveryPhone: sql<string | null>`NULL`,
          deliveryAddressLine1: locations.addressLine1,
          deliveryAddressLine2: sql<string | null>`NULL`,
          deliveryCity: locations.city,
          deliveryState: locations.stateOrProvince,
          deliveryPostalCode: locations.postalCode,
          deliveryCountry: locations.country,
          shippingNotes: transferOrders.shippingNotes,
          customerOrderNumber: sql<string | null>`NULL`,
        })
        .from(transferOrderShipments)
        .innerJoin(
          transferOrders,
          eq(
            transferOrderShipments.transferOrderId,
            transferOrders.transferOrderId,
          ),
        )
        .leftJoin(
          locations,
          eq(transferOrders.destinationLocationId, locations.locationId),
        )
        .where(eq(transferOrderShipments.shipmentId, shipmentId))
        .limit(1);

      if (transferRows.length === 0) {
        throw new NotFoundException(`Shipment '${shipmentId}' not found`);
      }

      const transferShipment = transferRows[0];
      const transferLines = await this.db
        .select({
          productCode: coreProducts.productNumber,
          description: coreProducts.name,
          quantityShipped: transferOrderShipmentLines.quantity,
        })
        .from(transferOrderShipmentLines)
        .innerJoin(
          transferOrderLines,
          eq(
            transferOrderShipmentLines.transferOrderLineId,
            transferOrderLines.transferOrderLineId,
          ),
        )
        .leftJoin(
          coreProducts,
          eq(transferOrderLines.productId, coreProducts.productId),
        )
        .where(eq(transferOrderShipmentLines.shipmentId, shipmentId));

      return this.formatResult(transferShipment, transferLines, options);
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

    return this.formatResult(shipment, lines, options);
  }

  private formatResult(
    shipment: {
      shipmentNumber: string;
      trackingNumber: string | null;
      notes: string | null;
      createdOn: Date | null;
      orderNumber: string | null;
      customerName: string | null;
      customerAddress: string | null;
      deliveryName?: string | null;
      deliveryCompanyName?: string | null;
      deliveryPhone?: string | null;
      deliveryAddressLine1?: string | null;
      deliveryAddressLine2?: string | null;
      deliveryCity?: string | null;
      deliveryState?: string | null;
      deliveryPostalCode?: string | null;
      deliveryCountry?: string | null;
      shippingNotes?: string | null;
      customerOrderNumber?: string | null;
    },
    lines: Array<{
      productCode: string | null;
      description: string | null;
      quantityShipped: string | null;
    }>,
    options?: Record<string, unknown>,
  ): ShippingDocketData {
    const addressParts = [
      shipment.deliveryAddressLine1,
      shipment.deliveryAddressLine2,
      [
        shipment.deliveryCity,
        shipment.deliveryState,
        shipment.deliveryPostalCode,
      ]
        .filter(Boolean)
        .join(' '),
      shipment.deliveryCountry,
    ].filter(Boolean);

    const customerAddress =
      addressParts.length > 0
        ? addressParts.join(', ')
        : shipment.customerAddress || '—';

    const mappedLines = lines.map((l) => ({
      productCode: l.productCode ?? '',
      description: l.description ?? '',
      quantityShipped: parseFloat(l.quantityShipped ?? '0'),
    }));

    const totalQuantity = mappedLines.reduce(
      (sum, l) => sum + l.quantityShipped,
      0,
    );

    const result: ShippingDocketData = {
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
        deliveryName: shipment.deliveryName ?? '',
        deliveryCompanyName: shipment.deliveryCompanyName ?? '',
        deliveryPhone: shipment.deliveryPhone ?? '',
        deliveryAddressLine1: shipment.deliveryAddressLine1 ?? '',
        deliveryAddressLine2: shipment.deliveryAddressLine2 ?? '',
        deliveryCity: shipment.deliveryCity ?? '',
        deliveryState: shipment.deliveryState ?? '',
        deliveryPostalCode: shipment.deliveryPostalCode ?? '',
        deliveryCountry: shipment.deliveryCountry ?? '',
        shippingNotes: shipment.shippingNotes ?? '',
        customerOrderNumber: shipment.customerOrderNumber ?? '',
      },
      lines: mappedLines,
      totalQuantity,
      totalLines: mappedLines.length,
      generatedAt:
        new Date().toLocaleDateString('en-IE') +
        ' ' +
        new Date().toLocaleTimeString('en-IE', {
          hour: '2-digit',
          minute: '2-digit',
        }),
    };

    const customText =
      (options?.customPdfText as string) || (options?.quoteIntroText as string);
    if (customText) {
      result.customPdfText = customText;
      result.quoteIntroText = customText;
    }

    return result;
  }
}

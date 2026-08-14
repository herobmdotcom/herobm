import { SystemResource, PurchaseReturnState } from '@herobm/shared';
import {
  ApiTags,
  ApiProperty,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { CasbinAction, CasbinResource } from '../auth/casbin.guard';
import {
  purchaseOrderReturns,
  purchaseOrders,
  purchaseOrderLineItems,
  products,
  purchaseOrderReturnLines,
  purchaseOrderReturnShipments,
  purchaseOrderReturnShipmentLines,
  purchaseDebitNotes,
  procurementEvents,
  suppliers,
  actors,
  bins,
} from '@herobm/db-schema';
import { eq, desc, inArray, or, sql, isNull, and } from 'drizzle-orm';
import { PurchaseReturnResponseDto } from './dto';

export class GlobalPurchaseReturnDto extends PurchaseReturnResponseDto {
  @ApiProperty({ required: false })
  orderNumber?: string;
  @ApiProperty({ required: false })
  vendorName?: string;
  @ApiProperty({ required: false })
  vendorId?: string;
  @ApiProperty({ required: false })
  currencyCode?: string;
  @ApiProperty({ required: false })
  debitNoteId?: string;
  @ApiProperty({ required: false })
  debitNoteNumber?: string;
  @ApiProperty({ required: false })
  debitNoteState?: string;
  @ApiProperty({ required: false })
  debitNoteTotalAmount?: string;
}

export class GlobalPurchaseReturnsListDto {
  @ApiProperty({ type: [GlobalPurchaseReturnDto] })
  data: GlobalPurchaseReturnDto[];
}

@Controller('purchase-returns')
@CasbinResource(SystemResource.PURCHASE_RETURNS)
@ApiTags('Purchase Returns')
export class GlobalPurchaseReturnsController {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Purchase Returns',
    description: 'Retrieve a list of purchase returns based on state.',
  })
  @ApiOkResponse({ type: [GlobalPurchaseReturnDto] })
  @ApiQuery({ name: 'stateCode', required: false })
  @ApiQuery({ name: 'requireDebitNote', required: false, type: Boolean })
  async getPurchaseReturns(
    @Query('stateCode') stateCodeStr?: string,
    @Query('requireDebitNote') requireDebitNote?: boolean,
  ) {
    let query = this.db
      .select({
        returnId: purchaseOrderReturns.returnId,
        returnNumber: purchaseOrderReturns.returnNumber,
        stateCode: purchaseOrderReturns.stateCode,
        createdOn: purchaseOrderReturns.createdOn,
        notes: purchaseOrderReturns.notes,
        orderNumber: purchaseOrders.orderNumber,
        purchaseOrderId: purchaseOrders.purchaseOrderId,
        vendorName: actors.name,
        debitNoteId: purchaseDebitNotes.debitNoteId,
        debitNoteNumber: purchaseDebitNotes.debitNoteNumber,
        debitNoteState: purchaseDebitNotes.stateCode,
        debitNoteTotalAmount: purchaseDebitNotes.totalAmount,
      })
      .from(purchaseOrderReturns)
      .leftJoin(
        purchaseOrders,
        eq(
          purchaseOrderReturns.purchaseOrderId,
          purchaseOrders.purchaseOrderId,
        ),
      )
      .leftJoin(suppliers, eq(purchaseOrders.vendorId, suppliers.vendorId))
      .leftJoin(actors, eq(suppliers.actorId, actors.actorId))
      .leftJoin(
        purchaseDebitNotes,
        eq(purchaseOrderReturns.returnId, purchaseDebitNotes.returnId),
      )
      .$dynamic();

    const conditions = [];

    if (stateCodeStr) {
      const states = stateCodeStr.split(',');
      conditions.push(
        inArray(
          purchaseOrderReturns.stateCode,
          states as PurchaseReturnState[],
        ),
      );
    }

    if (requireDebitNote === true || String(requireDebitNote) === 'true') {
      conditions.push(isNull(purchaseDebitNotes.debitNoteId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(purchaseOrderReturns.createdOn));

    const data = await query;

    return data;
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Purchase Return',
    description: 'Retrieve details for a specific purchase return.',
  })
  @ApiOkResponse({ type: GlobalPurchaseReturnDto })
  async getPurchaseReturnById(@Param('id') id: string) {
    const [ret] = await this.db
      .select({
        returnId: purchaseOrderReturns.returnId,
        returnNumber: purchaseOrderReturns.returnNumber,
        stateCode: purchaseOrderReturns.stateCode,
        createdOn: purchaseOrderReturns.createdOn,
        notes: purchaseOrderReturns.notes,
        orderNumber: purchaseOrders.orderNumber,
        purchaseOrderId: purchaseOrders.purchaseOrderId,
        vendorName: actors.name,
        vendorId: purchaseOrders.vendorId,
        currencyCode: purchaseOrders.currencyCode,
        debitNoteId: purchaseDebitNotes.debitNoteId,
        debitNoteNumber: purchaseDebitNotes.debitNoteNumber,
        debitNoteState: purchaseDebitNotes.stateCode,
        debitNoteTotalAmount: purchaseDebitNotes.totalAmount,
      })
      .from(purchaseOrderReturns)
      .leftJoin(
        purchaseOrders,
        eq(
          purchaseOrderReturns.purchaseOrderId,
          purchaseOrders.purchaseOrderId,
        ),
      )
      .leftJoin(suppliers, eq(purchaseOrders.vendorId, suppliers.vendorId))
      .leftJoin(actors, eq(suppliers.actorId, actors.actorId))
      .leftJoin(
        purchaseDebitNotes,
        eq(purchaseOrderReturns.returnId, purchaseDebitNotes.returnId),
      )
      .where(eq(purchaseOrderReturns.returnId, id))
      .limit(1);

    if (!ret) throw new NotFoundException('Purchase Return not found');

    const lines = await this.db
      .select({
        returnLineId: purchaseOrderReturnLines.returnLineId,
        returnId: purchaseOrderReturnLines.returnId,
        purchaseOrderLineId: purchaseOrderReturnLines.purchaseOrderLineId,
        quantityReturned: purchaseOrderReturnLines.quantityReturned,
        reason: purchaseOrderReturnLines.reason,
        returnFee: purchaseOrderReturnLines.returnFee,
        sourceBinId: purchaseOrderReturnLines.sourceBinId,
        sourceBinNumber: bins.binNumber,
        productId: purchaseOrderLineItems.productId,
        productNumber: products.productNumber,
        productDescription: purchaseOrderLineItems.productDescription,
        pricePerUnit: purchaseOrderLineItems.pricePerUnit,
        tax: purchaseOrderLineItems.tax,
      })
      .from(purchaseOrderReturnLines)
      .leftJoin(
        purchaseOrderLineItems,
        eq(
          purchaseOrderReturnLines.purchaseOrderLineId,
          purchaseOrderLineItems.purchaseOrderLineId,
        ),
      )
      .leftJoin(
        products,
        eq(purchaseOrderLineItems.productId, products.productId),
      )
      .leftJoin(bins, eq(purchaseOrderReturnLines.sourceBinId, bins.binId))
      .where(eq(purchaseOrderReturnLines.returnId, id));

    const shipments = await this.db
      .select()
      .from(purchaseOrderReturnShipments)
      .where(eq(purchaseOrderReturnShipments.returnId, id));

    const shipmentIds = shipments.map((s) => s.shipmentId);
    let shipmentLines: (typeof purchaseOrderReturnShipmentLines.$inferSelect)[] =
      [];
    if (shipmentIds.length > 0) {
      shipmentLines = await this.db
        .select()
        .from(purchaseOrderReturnShipmentLines)
        .where(
          inArray(purchaseOrderReturnShipmentLines.shipmentId, shipmentIds),
        );
    }

    const events = await this.db
      .select()
      .from(procurementEvents)
      .where(
        or(
          eq(procurementEvents.entityId, id),
          sql`${procurementEvents.payload}->>'returnId' = ${id}`,
        ),
      )
      .orderBy(desc(procurementEvents.createdOn));

    const debitNotes = await this.db
      .select({
        debitNoteId: purchaseDebitNotes.debitNoteId,
        debitNoteNumber: purchaseDebitNotes.debitNoteNumber,
        stateCode: purchaseDebitNotes.stateCode,
        createdOn: purchaseDebitNotes.createdOn,
        totalAmount: purchaseDebitNotes.totalAmount,
      })
      .from(purchaseDebitNotes)
      .where(eq(purchaseDebitNotes.returnId, id));

    return { ...ret, lines, shipments, shipmentLines, events, debitNotes };
  }
}

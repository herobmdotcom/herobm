import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Req,
  Body,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';
import { BackordersService } from './backorders.service';
import { Inject } from '@nestjs/common';
import {
  BACKORDER_STATE,
  calculateAvailableQuantity,
  SystemResource,
} from '@herobm/shared';
import {
  OpenDemandsListResponseDto,
  PoAllocationsListResponseDto,
  AvailablePoLinesListResponseDto,
  AllocationSuccessResponseDto,
  AllocationResolveResponseDto,
  LinkDemandToPoDto,
  ReallocateDemandDto,
  GeneratePOsDto,
  GenerateTransfersDto,
  OpenDemandDto,
  AvailablePoLineDto,
  PoAllocationDto,
  EmptyBodyDto,
} from './dto';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  backorders,
  products,
  salesOrders,
  salesOrderLineItems,
  productSuppliers,
  suppliers,
  locations,
  inventoryLevels,
  purchaseOrders,
} from '../drizzle/herobm-core-schema';
import { sql, eq, and, inArray } from 'drizzle-orm';

@ApiTags('Warehouse')
@Controller('allocations')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.PURCHASE_ORDERS)
export class AllocationsController {
  constructor(
    private readonly backordersService: BackordersService,
    @Inject(DRIZZLE) private db: DrizzleDB,
  ) {}

  @Get('open')
  @ApiOkResponse({ type: [OpenDemandDto] })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Open Demands',
    description:
      'Retrieve pending or awaiting-receipt backorders across all sales orders.',
  })
  async getOpenDemands() {
    const openDemands = await this.db
      .select({
        id: backorders.backorderId,
        salesOrderId: backorders.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        productId: backorders.productId,
        productName: products.productNumber,
        productDescription: products.name, // The product's actual name/description
        quantity: sql<number>`CAST(${backorders.quantity} AS float)`,
        createdOn: backorders.createdOn,
        vendorId: productSuppliers.vendorId,
        vendorName: suppliers.name,
        costPrice: sql<number>`CAST(${productSuppliers.costPrice} AS float)`,
        currencyCode: suppliers.currencyCode,
        locationId: salesOrderLineItems.fulfillmentLocationId,
        locationName: locations.name,
        purchaseOrderId: backorders.purchaseOrderId,
        purchaseOrderNumber: purchaseOrders.orderNumber,
        purchaseOrderState: purchaseOrders.stateCode,
      })
      .from(backorders)
      .leftJoin(
        salesOrders,
        eq(backorders.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(
        salesOrderLineItems,
        eq(backorders.salesOrderLineId, salesOrderLineItems.salesOrderLineId),
      )
      .leftJoin(
        locations,
        eq(salesOrderLineItems.fulfillmentLocationId, locations.locationId),
      )
      .leftJoin(products, eq(backorders.productId, products.productId))
      .leftJoin(
        productSuppliers,
        and(
          eq(productSuppliers.productId, backorders.productId),
          eq(productSuppliers.isPreferred, true),
        ),
      )
      .leftJoin(suppliers, eq(suppliers.vendorId, productSuppliers.vendorId))
      .leftJoin(
        purchaseOrders,
        eq(backorders.purchaseOrderId, purchaseOrders.purchaseOrderId),
      )
      .where(
        inArray(backorders.stateCode, [
          BACKORDER_STATE.PENDING_SUPPLY,
          BACKORDER_STATE.AWAITING_RECEIPT,
        ]),
      );

    // -------------------------------------------------------------------
    // Enrich each row with cross-location inventory availability.
    //
    // We do a single batched lookup against the `inventory_levels` view
    // scoped by productId (indexed column) for all distinct products in
    // the open demand list, then bucket the results in-memory.
    //
    // Availability is derived from the shared `calculateAvailableQuantity`
    // helper (on-hand minus committed minus reserved) — never inlined SQL
    // arithmetic — to keep us consistent with the rest of the system per
    // conventions §27.
    // -------------------------------------------------------------------
    const productIds = Array.from(
      new Set(
        openDemands.map((d) => d.productId).filter((id): id is string => !!id),
      ),
    );

    let inventoryRows: Array<{
      productId: string | null;
      locationId: string | null;
      locationName: string | null;
      quantityOnHand: string | null;
      quantityCommitted: string | null;
      quantityReserved: string | null;
    }> = [];

    if (productIds.length > 0) {
      inventoryRows = await this.db
        .select({
          productId: inventoryLevels.productId,
          locationId: inventoryLevels.locationId,
          locationName: locations.name,
          quantityOnHand: inventoryLevels.quantityOnHand,
          quantityCommitted: inventoryLevels.quantityCommitted,
          quantityReserved: inventoryLevels.quantityReserved,
        })
        .from(inventoryLevels)
        .leftJoin(
          locations,
          eq(inventoryLevels.locationId, locations.locationId),
        )
        .where(inArray(inventoryLevels.productId, productIds));
    }

    // Bucket inventory rows by productId for fast lookup.
    const inventoryByProduct = new Map<
      string,
      Array<{
        locationId: string;
        locationName: string;
        availableQty: number;
      }>
    >();
    for (const row of inventoryRows) {
      if (!row.productId || !row.locationId) continue;
      const availableQty = calculateAvailableQuantity(
        row.quantityOnHand,
        row.quantityCommitted,
        row.quantityReserved,
      );
      if (availableQty <= 0) continue; // Exclude zero-stock locations
      const bucket = inventoryByProduct.get(row.productId) ?? [];
      bucket.push({
        locationId: row.locationId,
        locationName: row.locationName ?? '',
        availableQty,
      });
      inventoryByProduct.set(row.productId, bucket);
    }

    const enriched = openDemands.map((d) => {
      const bucket = d.productId
        ? (inventoryByProduct.get(d.productId) ?? [])
        : [];
      // Exclude the demand's own destination location
      const availableElsewhere = bucket.filter(
        (b) => b.locationId !== d.locationId,
      );
      return { ...d, availableElsewhere };
    });

    return enriched;
  }

  @Get('by-po/:poId')
  @ApiOkResponse({ type: [PoAllocationDto] })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get PO Allocations',
    description:
      'Retrieve all backorder allocations linked to a specific purchase order.',
  })
  async getAllocationsByPo(@Param('poId') poId: string) {
    const allocations = await this.db
      .select({
        id: backorders.backorderId,
        salesOrderId: backorders.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        productId: backorders.productId,
        productName: products.productNumber,
        quantity: sql<number>`CAST(${backorders.quantity} AS float)`,
        createdOn: backorders.createdOn,
        purchaseOrderLineId: backorders.purchaseOrderLineId,
        stateCode: backorders.stateCode,
      })
      .from(backorders)
      .leftJoin(
        salesOrders,
        eq(backorders.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(products, eq(backorders.productId, products.productId))
      .where(eq(backorders.purchaseOrderId, poId));
    return allocations;
  }

  @Get('available-po-lines')
  @ApiOkResponse({ type: [AvailablePoLineDto] })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Available PO Lines',
    description:
      'Find open purchase order lines for a specific product to allocate against.',
  })
  async getAvailablePoLines(@Query('productId') productId: string) {
    const lines = await this.backordersService.getAvailablePoLines(productId);
    return lines;
  }

  @Post('link-po')
  @ApiCreatedResponse({ type: AllocationSuccessResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Link Demand To PO',
    description:
      'Manually allocate a backorder demand to an open purchase order line.',
  })
  async linkDemandToPo(
    @Body() payload: LinkDemandToPoDto,
    @AuthUser() user: JwtUser,
  ) {
    const actor = user?.username || 'system';
    const { demandId, purchaseOrderLineId, quantity } = payload;
    await this.backordersService.linkDemandToPo(
      demandId,
      purchaseOrderLineId,
      Number(quantity),
      actor,
    );
    return { success: true };
  }

  @Post('resolve')
  @ApiCreatedResponse({ type: AllocationResolveResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Resolve Open Demands',
    description:
      'Run the MRP engine to automatically resolve backorder demands.',
  })
  @ApiBody({ type: EmptyBodyDto })
  async resolveOpenDemands(@AuthUser() user: JwtUser) {
    const actor = user?.username || 'system';
    await this.backordersService.resolveOpenDemands(actor);
    return { success: true, message: 'MRP Allocation Engine run completed' };
  }

  @Post(':id/unlink')
  @ApiCreatedResponse({ type: AllocationSuccessResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Unlink Demand',
    description:
      'Remove the link between a backorder demand and its allocated purchase order.',
  })
  @ApiBody({ type: EmptyBodyDto })
  async unlinkDemand(@Param('id') id: string, @AuthUser() user: JwtUser) {
    const actor = user?.username || 'system';
    await this.backordersService.unlinkDemand(id, actor);
    return { success: true };
  }

  @Post(':id/reallocate')
  @ApiCreatedResponse({ type: AllocationSuccessResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Reallocate Demand',
    description:
      'Change the fulfillment location for an open backorder demand.',
  })
  async reallocateDemand(
    @Param('id') id: string,
    @Body() dto: ReallocateDemandDto,
    @AuthUser() user: JwtUser,
  ) {
    const actor = user?.username || 'system';
    await this.backordersService.reallocateDemand(id, dto.locationId, actor);
    return { success: true };
  }

  @Post('generate-pos')
  @ApiCreatedResponse({ type: AllocationSuccessResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Generate POs',
    description: 'Bulk create purchase orders from open backorder demands.',
  })
  async generatePOs(
    @Body() payload: GeneratePOsDto,
    @AuthUser() user: JwtUser,
  ) {
    const actor = user?.username || 'system';
    await this.backordersService.generatePOsFromDemands(payload, actor);
    return { success: true };
  }

  @Post('generate-transfers')
  @ApiCreatedResponse({ type: AllocationSuccessResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Generate Transfers',
    description: 'Bulk create inventory transfers from open backorder demands.',
  })
  async generateTransfers(
    @Body() payload: GenerateTransfersDto,
    @AuthUser() user: JwtUser,
  ) {
    const actor = user?.username || 'system';
    await this.backordersService.generateTransfersFromDemands(payload, actor);
    return { success: true };
  }
}

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
import { BACKORDER_STATE, calculateAvailableQuantity } from '@modbm/shared';
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
} from '../drizzle/modbm-core-schema';
import { sql, eq, and, inArray } from 'drizzle-orm';

@Controller('allocations')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('purchase-orders')
export class AllocationsController {
  constructor(
    private readonly backordersService: BackordersService,
    @Inject(DRIZZLE) private db: DrizzleDB,
  ) {}

  @Get('open')
  @CasbinAction('read')
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
      .where(
        and(
          sql`${backorders.purchaseOrderId} IS NULL`,
          sql`${backorders.transferOrderId} IS NULL`,
          eq(backorders.stateCode, BACKORDER_STATE.PENDING_SUPPLY),
        ),
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

    return { data: enriched };
  }

  @Get('by-po/:poId')
  @CasbinAction('read')
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
    return { data: allocations };
  }

  @Get('available-po-lines')
  @CasbinAction('read')
  async getAvailablePoLines(@Query('productId') productId: string) {
    const lines = await this.backordersService.getAvailablePoLines(productId);
    return { data: lines };
  }

  @Post('link-po')
  @CasbinAction('write')
  async linkDemandToPo(@Body() payload: any, @AuthUser() user: JwtUser) {
    const actor = user?.username || 'system';
    const { demandId, purchaseOrderLineId, quantity } = payload;
    await this.backordersService.linkDemandToPo(
      demandId,
      purchaseOrderLineId,
      quantity,
      actor,
    );
    return { success: true };
  }

  @Post('resolve')
  @CasbinAction('write')
  async resolveOpenDemands(@AuthUser() user: JwtUser) {
    const actor = user?.username || 'system';
    await this.backordersService.resolveOpenDemands(actor);
    return { success: true, message: 'MRP Allocation Engine run completed' };
  }

  @Post(':id/unlink')
  @CasbinAction('write')
  async unlinkDemand(@Param('id') id: string, @AuthUser() user: JwtUser) {
    const actor = user?.username || 'system';
    await this.backordersService.unlinkDemand(id, actor);
    return { success: true };
  }

  @Post(':id/reallocate')
  @CasbinAction('write')
  async reallocateDemand(
    @Param('id') id: string,
    @Body('locationId') locationId: string,
    @AuthUser() user: JwtUser,
  ) {
    const actor = user?.username || 'system';
    await this.backordersService.reallocateDemand(id, locationId, actor);
    return { success: true };
  }

  @Post('generate-pos')
  @CasbinAction('write')
  async generatePOs(@Body() payload: any, @AuthUser() user: JwtUser) {
    const actor = user?.username || 'system';
    await this.backordersService.generatePOsFromDemands(payload, actor);
    return { success: true };
  }

  @Post('generate-transfers')
  @CasbinAction('write')
  async generateTransfers(@Body() payload: any, @AuthUser() user: JwtUser) {
    const actor = user?.username || 'system';
    await this.backordersService.generateTransfersFromDemands(payload, actor);
    return { success: true };
  }
}

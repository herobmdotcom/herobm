import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Req,
  Body,
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
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  backorders,
  products,
  salesOrders,
  productSuppliers,
  suppliers,
  locations,
} from '../drizzle/modbm-core-schema';
import { sql, eq, and } from 'drizzle-orm';

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
        locationId: salesOrders.fulfillmentLocationId,
        locationName: locations.name,
      })
      .from(backorders)
      .leftJoin(
        salesOrders,
        eq(backorders.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(
        locations,
        eq(salesOrders.fulfillmentLocationId, locations.locationId),
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
          eq(backorders.stateCode, 'pending_supply'),
        ),
      );
    return { data: openDemands };
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

  @Post('generate-pos')
  @CasbinAction('write')
  async generatePOs(@Body() payload: any, @AuthUser() user: JwtUser) {
    const actor = user?.username || 'system';
    await this.backordersService.generatePOsFromDemands(payload, actor);
    return { success: true };
  }
}

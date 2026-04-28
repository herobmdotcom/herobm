import { Controller, Post, Get, Param, UseGuards, Req } from '@nestjs/common';
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
        productName: products.productNumber, // Using productNumber instead of name since it is the primary identifier
        quantity: sql<number>`CAST(${backorders.quantity} AS float)`,
        createdOn: backorders.createdOn,
      })
      .from(backorders)
      .leftJoin(
        salesOrders,
        eq(backorders.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(products, eq(backorders.productId, products.productId))
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
}

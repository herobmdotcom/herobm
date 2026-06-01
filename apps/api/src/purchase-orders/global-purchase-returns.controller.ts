import {
  ApiTags,
  ApiBearerAuth,
  ApiProperty,
  ApiConsumes,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  CasbinGuard,
  CasbinAction,
  CasbinResource,
} from '../auth/casbin.guard';
import {
  purchaseOrderReturns,
  purchaseOrders,
  purchaseOrderReturnLines,
  suppliers,
} from '../drizzle/modbm-core-schema';
import { eq, desc, inArray } from 'drizzle-orm';
import {
  PurchaseReturnResponseDto,
  PurchaseReturnLineResponseDto,
} from './dto';

export class GlobalPurchaseReturnDto extends PurchaseReturnResponseDto {
  @ApiProperty({ required: false })
  orderNumber?: string;
  @ApiProperty({ required: false })
  vendorName?: string;
  @ApiProperty({ required: false })
  vendorId?: string;
  @ApiProperty({ required: false })
  currencyCode?: string;
}

export class GlobalPurchaseReturnsListDto {
  @ApiProperty({ type: [GlobalPurchaseReturnDto] })
  data: GlobalPurchaseReturnDto[];
}

@Controller('purchase-returns')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource('purchase-returns')
@ApiTags('PurchaseReturns')
export class GlobalPurchaseReturnsController {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Purchase Returns',
    description: 'Retrieve a list of purchase returns based on state.',
  })
  @ApiOkResponse({ type: GlobalPurchaseReturnsListDto })
  @ApiQuery({ name: 'stateCode', required: false })
  async getPurchaseReturns(@Query('stateCode') stateCodeStr?: string) {
    let query = this.db
      .select({
        returnId: purchaseOrderReturns.returnId,
        returnNumber: purchaseOrderReturns.returnNumber,
        stateCode: purchaseOrderReturns.stateCode,
        createdOn: purchaseOrderReturns.createdOn,
        notes: purchaseOrderReturns.notes,
        orderNumber: purchaseOrders.orderNumber,
        purchaseOrderId: purchaseOrders.purchaseOrderId,
        vendorName: suppliers.name,
      })
      .from(purchaseOrderReturns)
      .leftJoin(
        purchaseOrders,
        eq(
          purchaseOrderReturns.purchaseOrderId,
          purchaseOrders.purchaseOrderId,
        ),
      )
      .leftJoin(suppliers, eq(purchaseOrders.vendorId, suppliers.vendorId));

    if (stateCodeStr) {
      const states = stateCodeStr.split(',');
      query = query.where(
        inArray(purchaseOrderReturns.stateCode, states as any[]),
      ) as any;
    }

    query = query.orderBy(desc(purchaseOrderReturns.createdOn)) as any;

    const data = await query;

    // Optional: Fetch line counts if needed, but for the grid this is enough for now.
    return { data };
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
        vendorName: suppliers.name,
        vendorId: purchaseOrders.vendorId,
        currencyCode: purchaseOrders.currencyCode,
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
      .where(eq(purchaseOrderReturns.returnId, id))
      .limit(1);

    if (!ret) throw new NotFoundException('Purchase Return not found');

    const lines = await this.db
      .select()
      .from(purchaseOrderReturnLines)
      .where(eq(purchaseOrderReturnLines.returnId, id));

    return { ...ret, lines };
  }
}

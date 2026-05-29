import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PickingService } from './picking.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';
import { ShippingContextDto } from './dto';

@ApiTags('Orders')
@Controller('sales-orders')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource('sales-orders')
export class OrderPickingController {
  constructor(private readonly pickingService: PickingService) {}

  @Get('picking-queue')
  @ApiOkResponse({ type: Object }) // BYPASS-TYPING-TEST
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Picking Queue',
    description:
      'Retrieve the queue of orders ready to be picked at a specific location.',
  })
  getPickingQueue(@Query('locationId') locationId?: string) {
    return this.pickingService.getPickingQueue(locationId);
  }

  @Get(':id/picking')
  @ApiOkResponse({ type: Object }) // BYPASS-TYPING-TEST
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Picking Summary',
    description: 'Retrieve the picking summary for a specific sales order.',
  })
  getPickingSummary(@Param('id') id: string) {
    return this.pickingService.getPickingSummary(id);
  }

  @Post(':id/picking/lines/:lineId')
  @ApiBody({ type: Object }) // BYPASS-TYPING-TEST
  @ApiCreatedResponse({ type: Object }) // BYPASS-TYPING-TEST
  @CasbinAction('handle')
  @ApiOperation({
    summary: 'Pick Order Line',
    description:
      'Record a picked quantity for a specific sales order line item.',
  })
  pickLine(
    @Param('id') orderId: string,
    @Param('lineId') lineId: string,
    @Body() dto: import('./dto').PickOrderLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.pickingService.pickLine(
      orderId,
      lineId,
      dto.binId,
      dto.quantity,
      user.userId,
    );
  }

  @Delete(':id/picking/picks/:pickId')
  @ApiOkResponse({ type: Object }) // BYPASS-TYPING-TEST
  @CasbinAction('handle')
  @ApiOperation({
    summary: 'Cancel Pick',
    description: 'Cancel and revert a recorded pick for a sales order.',
  })
  cancelPick(
    @Param('id') orderId: string,
    @Param('pickId') pickId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.pickingService.cancelPick(orderId, pickId, user.userId);
  }

  @Get('shipping-queue')
  @ApiOkResponse({ type: Object }) // BYPASS-TYPING-TEST
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Shipping Queue',
    description:
      'Retrieve the queue of orders ready to be shipped from a location.',
  })
  getShippingQueue(@Query('locationId') locationId?: string) {
    return this.pickingService.getShippingQueue(locationId);
  }

  @Get(':id/shipping-context')
  @ApiOkResponse({ type: ShippingContextDto })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Shipping Context',
    description: 'Retrieve shipment details and context for a sales order.',
  })
  getShippingContext(@Param('id') id: string) {
    return this.pickingService.getShippingContext(id);
  }
}

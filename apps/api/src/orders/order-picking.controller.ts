import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
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

@Controller('sales-orders')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('sales-orders')
export class OrderPickingController {
  constructor(private readonly pickingService: PickingService) {}

  @Get(':id/picking')
  @CasbinAction('read')
  getPickingSummary(@Param('id') id: string) {
    return this.pickingService.getPickingSummary(id);
  }

  @Patch(':id/picking/lines/:lineId')
  @CasbinAction('write')
  pickLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body('quantityPicked') quantityPicked: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.pickingService.pickLine(
      id,
      lineId,
      quantityPicked,
      user.username,
    );
  }

  @Patch(':id/picking/lines/:lineId/location')
  @CasbinAction('write')
  updateLineLocation(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body('fulfillmentLocationId') locationId: string,
    @AuthUser() user: JwtUser,
  ) {
    if (!locationId) {
      throw new Error('Fulfillment location must be provided');
    }
    return this.pickingService.updateLineLocation(
      id,
      lineId,
      locationId,
      user.username,
    );
  }

  @Post(':id/picking/lines/:lineId/pick-all')
  @CasbinAction('write')
  pickAllForLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.pickingService.pickAllForLine(id, lineId, user.username);
  }

  @Post(':id/picking/pick-all')
  @CasbinAction('write')
  pickAllOrder(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.pickingService.pickAllOrder(id, user.username);
  }
}

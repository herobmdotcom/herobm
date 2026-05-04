import {
  Controller,
  Get,
  Post,
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

@Controller('sales-orders')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('sales-orders')
export class OrderPickingController {
  constructor(private readonly pickingService: PickingService) {}

  @Get('picking-queue')
  @CasbinAction('read')
  getPickingQueue(@Query('locationId') locationId?: string) {
    return this.pickingService.getPickingQueue(locationId);
  }

  @Get(':id/picking')
  @CasbinAction('read')
  getPickingSummary(@Param('id') id: string) {
    return this.pickingService.getPickingSummary(id);
  }

  @Post(':id/picking/lines/:lineId')
  @CasbinAction('write')
  pickLine(
    @Param('id') orderId: string,
    @Param('lineId') lineId: string,
    @Body('binId') binId: string,
    @Body('quantity') quantity: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.pickingService.pickLine(
      orderId,
      lineId,
      binId,
      quantity,
      user.userId,
    );
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PickingService } from './picking.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@Controller('sales-orders')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('orders')
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
    @Req() req: any,
  ) {
    return this.pickingService.pickLine(
      id,
      lineId,
      quantityPicked,
      req.user.username,
    );
  }

  @Post(':id/picking/lines/:lineId/pick-all')
  @CasbinAction('write')
  pickAllForLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Req() req: any,
  ) {
    return this.pickingService.pickAllForLine(id, lineId, req.user.username);
  }

  @Post(':id/picking/pick-all')
  @CasbinAction('write')
  pickAllOrder(@Param('id') id: string, @Req() req: any) {
    return this.pickingService.pickAllOrder(id, req.user.username);
  }
}

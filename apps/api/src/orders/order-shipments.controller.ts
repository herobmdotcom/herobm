import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ShipmentService } from './shipment.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import {
  CreateShipmentDto,
  UpdateShipmentDto,
  AddShipmentLineDto,
  UpdateShipmentLineDto,
} from './dto';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

@Controller('sales-orders')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('sales-orders')
export class OrderShipmentsController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Post(':id/shipments')
  @CasbinAction('write')
  createShipment(
    @Param('id') id: string,
    @Body() body: CreateShipmentDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.shipmentService.createShipment(id, body, user.username);
  }

  @Get(':id/shipments')
  @CasbinAction('read')
  findShipments(@Param('id') id: string) {
    return this.shipmentService.findByOrder(id);
  }

  @Get(':id/shipments/:shipmentId')
  @CasbinAction('read')
  findShipment(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
  ) {
    return this.shipmentService.findOne(shipmentId);
  }

  @Patch(':id/shipments/:shipmentId')
  @CasbinAction('write')
  updateShipment(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
    @Body() body: UpdateShipmentDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.shipmentService.updateShipment(shipmentId, body, user.username);
  }

  @Patch(':id/shipments/:shipmentId/state')
  @CasbinAction('write')
  changeShipmentState(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
    @Body('stateCode') stateCode: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.shipmentService.changeShipmentState(
      shipmentId,
      stateCode,
      user.username,
    );
  }

  @Post(':id/shipments/:shipmentId/lines')
  @CasbinAction('write')
  addShipmentLine(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
    @Body() body: AddShipmentLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.shipmentService.addShipmentLine(
      shipmentId,
      body,
      user.username,
    );
  }

  @Patch(':id/shipments/:shipmentId/lines/:lineId')
  @CasbinAction('write')
  updateShipmentLine(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
    @Param('lineId') lineId: string,
    @Body() body: UpdateShipmentLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.shipmentService.updateShipmentLine(
      shipmentId,
      lineId,
      body,
      user.username,
    );
  }

  @Delete(':id/shipments/:shipmentId/lines/:lineId')
  @CasbinAction('write')
  removeShipmentLine(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
    @Param('lineId') lineId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.shipmentService.removeShipmentLine(
      shipmentId,
      lineId,
      user.username,
    );
  }
}

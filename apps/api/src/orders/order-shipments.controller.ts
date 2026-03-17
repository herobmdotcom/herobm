import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
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
    @Req() req: any,
  ) {
    return this.shipmentService.createShipment(id, body, req.user.username);
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
    @Req() req: any,
  ) {
    return this.shipmentService.updateShipment(
      shipmentId,
      body,
      req.user.username,
    );
  }

  @Patch(':id/shipments/:shipmentId/state')
  @CasbinAction('write')
  changeShipmentState(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
    @Body('stateCode') stateCode: string,
    @Req() req: any,
  ) {
    return this.shipmentService.changeShipmentState(
      shipmentId,
      stateCode,
      req.user.username,
    );
  }

  @Post(':id/shipments/:shipmentId/lines')
  @CasbinAction('write')
  addShipmentLine(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
    @Body() body: AddShipmentLineDto,
    @Req() req: any,
  ) {
    return this.shipmentService.addShipmentLine(
      shipmentId,
      body,
      req.user.username,
    );
  }

  @Patch(':id/shipments/:shipmentId/lines/:lineId')
  @CasbinAction('write')
  updateShipmentLine(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
    @Param('lineId') lineId: string,
    @Body() body: UpdateShipmentLineDto,
    @Req() req: any,
  ) {
    return this.shipmentService.updateShipmentLine(
      shipmentId,
      lineId,
      body,
      req.user.username,
    );
  }

  @Delete(':id/shipments/:shipmentId/lines/:lineId')
  @CasbinAction('write')
  removeShipmentLine(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
    @Param('lineId') lineId: string,
    @Req() req: any,
  ) {
    return this.shipmentService.removeShipmentLine(
      shipmentId,
      lineId,
      req.user.username,
    );
  }
}

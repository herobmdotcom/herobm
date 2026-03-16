import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrdersService } from './orders.service';
import { OrdersWriteService } from './orders-write.service';
import { ReturnsWriteService } from './returns-write.service';
import { PickingService } from './picking.service';
import { ShipmentService } from './shipment.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@Controller('orders')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersWriteService: OrdersWriteService,
    private readonly returnsWriteService: ReturnsWriteService,
    private readonly pickingService: PickingService,
    private readonly shipmentService: ShipmentService,
  ) {}

  // -------------------------------------------------------------------------
  // Read endpoints — unified list (ABM + app via UNION)
  // -------------------------------------------------------------------------

  @Get()
  @CasbinAction('read')
  findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.findAll({
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @CasbinAction('read')
  findOne(@Param('id') id: string, @Query('source') source?: string) {
    if (source === 'app') {
      return this.ordersWriteService.findOne(id);
    }
    if (source === 'abm') {
      return this.ordersService.findAbmOrder(id);
    }
    return this.ordersService.findOne(id);
  }

  // -------------------------------------------------------------------------
  // Write endpoints (modbm_core app data)
  // -------------------------------------------------------------------------

  @Post()
  @CasbinAction('write')
  create(@Body() body: any, @Req() req: any) {
    return this.ordersWriteService.create(body, req.user.username);
  }

  @Patch(':id')
  @CasbinAction('write')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.ordersWriteService.update(id, body, req.user.username);
  }

  @Patch(':id/state')
  @CasbinAction('write')
  changeState(
    @Param('id') id: string,
    @Body('stateCode') stateCode: string,
    @Req() req: any,
  ) {
    return this.ordersWriteService.changeState(id, stateCode, req.user.username);
  }

  @Post(':id/lines')
  @CasbinAction('write')
  addLine(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.ordersWriteService.addLine(id, body, req.user.username);
  }

  @Patch(':id/lines/:lineId')
  @CasbinAction('write')
  updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.ordersWriteService.updateLine(id, lineId, body, req.user.username);
  }

  @Delete(':id/lines/:lineId')
  @CasbinAction('write')
  removeLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Req() req: any,
  ) {
    return this.ordersWriteService.removeLine(id, lineId, req.user.username);
  }

  // -------------------------------------------------------------------------
  // Returns endpoints (sub-resource of orders)
  // -------------------------------------------------------------------------

  @Post(':id/returns')
  @CasbinAction('write')
  createReturn(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.returnsWriteService.createReturn(id, body, req.user.username);
  }

  @Get(':id/returns')
  @CasbinAction('read')
  findReturns(@Param('id') id: string) {
    return this.returnsWriteService.findByOrder(id);
  }

  @Get(':id/returns/:returnId')
  @CasbinAction('read')
  findReturn(@Param('id') _id: string, @Param('returnId') returnId: string) {
    return this.returnsWriteService.findOne(returnId);
  }

  @Patch(':id/returns/:returnId')
  @CasbinAction('write')
  updateReturn(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.returnsWriteService.updateReturn(returnId, body, req.user.username);
  }

  @Patch(':id/returns/:returnId/state')
  @CasbinAction('write')
  changeReturnState(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Body('stateCode') stateCode: string,
    @Req() req: any,
  ) {
    return this.returnsWriteService.changeReturnState(returnId, stateCode, req.user.username);
  }

  @Post(':id/returns/:returnId/lines')
  @CasbinAction('write')
  addReturnLine(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.returnsWriteService.addReturnLine(returnId, body, req.user.username);
  }

  @Patch(':id/returns/:returnId/lines/:lineId')
  @CasbinAction('write')
  updateReturnLine(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Param('lineId') lineId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.returnsWriteService.updateReturnLine(returnId, lineId, body, req.user.username);
  }

  @Delete(':id/returns/:returnId/lines/:lineId')
  @CasbinAction('write')
  removeReturnLine(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Param('lineId') lineId: string,
    @Req() req: any,
  ) {
    return this.returnsWriteService.removeReturnLine(returnId, lineId, req.user.username);
  }

  // -------------------------------------------------------------------------
  // Picking endpoints
  // -------------------------------------------------------------------------

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
    return this.pickingService.pickLine(id, lineId, quantityPicked, req.user.username);
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

  // -------------------------------------------------------------------------
  // Shipment endpoints (sub-resource of orders)
  // -------------------------------------------------------------------------

  @Post(':id/shipments')
  @CasbinAction('write')
  createShipment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
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
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.shipmentService.updateShipment(shipmentId, body, req.user.username);
  }

  @Patch(':id/shipments/:shipmentId/state')
  @CasbinAction('write')
  changeShipmentState(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
    @Body('stateCode') stateCode: string,
    @Req() req: any,
  ) {
    return this.shipmentService.changeShipmentState(shipmentId, stateCode, req.user.username);
  }

  @Post(':id/shipments/:shipmentId/lines')
  @CasbinAction('write')
  addShipmentLine(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.shipmentService.addShipmentLine(shipmentId, body, req.user.username);
  }

  @Patch(':id/shipments/:shipmentId/lines/:lineId')
  @CasbinAction('write')
  updateShipmentLine(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
    @Param('lineId') lineId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.shipmentService.updateShipmentLine(shipmentId, lineId, body, req.user.username);
  }

  @Delete(':id/shipments/:shipmentId/lines/:lineId')
  @CasbinAction('write')
  removeShipmentLine(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
    @Param('lineId') lineId: string,
    @Req() req: any,
  ) {
    return this.shipmentService.removeShipmentLine(shipmentId, lineId, req.user.username);
  }
}

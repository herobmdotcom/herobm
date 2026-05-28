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
  ShipmentResponseDto,
} from './dto';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

@ApiTags('Orders')
@Controller('sales-orders')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('sales-orders')
export class OrderShipmentsController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Post(':id/shipments')
  @ApiBody({ type: Object })
  @ApiCreatedResponse({ type: Object })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Shipment',
    description: 'Create a new shipment for a sales order.',
  })
  createShipment(
    @Param('id') id: string,
    @Body() body: CreateShipmentDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.shipmentService.createShipment(id, body, user.username);
  }

  @Get(':id/shipments')
  @ApiOkResponse({ type: ShipmentResponseDto, isArray: true })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find Order Shipments',
    description:
      'Retrieve all shipments associated with a specific sales order.',
  })
  findShipments(@Param('id') id: string) {
    return this.shipmentService.findByOrder(id);
  }

  @Get(':id/shipments/:shipmentId')
  @ApiOkResponse({ type: ShipmentResponseDto })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find Shipment',
    description: 'Retrieve detailed information for a specific shipment.',
  })
  findShipment(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
  ) {
    return this.shipmentService.findOne(shipmentId);
  }

  @Patch(':id/shipments/:shipmentId')
  @ApiBody({ type: Object })
  @ApiOkResponse({ type: Object })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Shipment',
    description: 'Modify the details of an existing shipment.',
  })
  updateShipment(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
    @Body() body: UpdateShipmentDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.shipmentService.updateShipment(shipmentId, body, user.username);
  }

  @Patch(':id/shipments/:shipmentId/state')
  @ApiBody({ type: Object })
  @ApiOkResponse({ type: Object })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Change Shipment State',
    description: 'Update the processing state of a shipment.',
  })
  changeShipmentState(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
    @Body() dto: import('./dto').ChangeShipmentStateDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.shipmentService.changeShipmentState(
      shipmentId,
      dto.stateCode,
      user.username,
    );
  }

  @Post(':id/shipments/:shipmentId/cancel')
  @ApiBody({ type: Object })
  @ApiCreatedResponse({ type: Object })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Cancel Shipment',
    description: 'Cancel an open shipment and revert picked inventory.',
  })
  cancelShipment(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.shipmentService.cancelShipment(shipmentId, user.username);
  }

  @Post(':id/shipments/:shipmentId/lines')
  @ApiBody({ type: Object })
  @ApiCreatedResponse({ type: Object })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Shipment Line',
    description: 'Add a new line item to a shipment.',
  })
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
  @ApiBody({ type: Object })
  @ApiOkResponse({ type: Object })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Shipment Line',
    description: 'Modify an existing line item on a shipment.',
  })
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
  @ApiOkResponse({ type: Object })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Shipment Line',
    description: 'Delete a line item from a shipment.',
  })
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

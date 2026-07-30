import { SystemResource } from '@herobm/shared';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ShipmentService } from './shipment.service';
import { TransferService } from './transfers/transfers.service';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import {
  CreateShipmentDto,
  UpdateShipmentDto,
  AddShipmentLineDto,
  UpdateShipmentLineDto,
  ShipmentResponseDto,
  ChangeShipmentStateDto,
} from './dto';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { transferOrders } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';

@ApiTags('Warehouse')
@Controller('sales-orders')
@CasbinResource(SystemResource.SALES_ORDERS)
export class OrderShipmentsController {
  constructor(
    private readonly shipmentService: ShipmentService,
    private readonly transfersService: TransferService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  @Post(':id/shipments')
  @ApiCreatedResponse({ type: ShipmentResponseDto })
  @CasbinAction('handle')
  @ApiOperation({
    summary: 'Create Shipment',
    description: 'Create a new shipment for a sales order or transfer order.',
  })
  async createShipment(
    @Param('id') id: string,
    @Body() body: CreateShipmentDto,
    @AuthUser() user: JwtUser,
  ) {
    const isTransfer = await this.db.query.transferOrders.findFirst({
      where: eq(transferOrders.transferOrderId, id),
    });

    if (isTransfer) {
      return this.transfersService.createShipment(id, body, user.username);
    }
    return this.shipmentService.createShipment(id, body, user.username);
  }

  @Get(':id/shipments')
  @ApiOkResponse({ type: [ShipmentResponseDto] })
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
  @ApiOkResponse({ type: ShipmentResponseDto })
  @CasbinAction('handle')
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
  @ApiOkResponse({ type: ShipmentResponseDto })
  @CasbinAction('handle')
  @ApiOperation({
    summary: 'Change Shipment State',
    description: 'Update the processing state of a shipment.',
  })
  changeShipmentState(
    @Param('id') _id: string,
    @Param('shipmentId') shipmentId: string,
    @Body() dto: ChangeShipmentStateDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.shipmentService.changeShipmentState(
      shipmentId,
      dto.stateCode,
      user.username,
    );
  }

  @Post(':id/shipments/:shipmentId/cancel')
  @ApiCreatedResponse({ type: ShipmentResponseDto })
  @CasbinAction('handle')
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
  @ApiCreatedResponse({ type: ShipmentResponseDto })
  @CasbinAction('handle')
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
  @ApiOkResponse({ type: ShipmentResponseDto })
  @CasbinAction('handle')
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
  @ApiOkResponse({ type: ShipmentResponseDto })
  @CasbinAction('handle')
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

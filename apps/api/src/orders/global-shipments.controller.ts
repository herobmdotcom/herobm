import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { ShipmentService } from './shipment.service';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('Orders')
@Controller('shipments')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource('sales-orders')
export class GlobalShipmentsController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Get()
  @ApiOkResponse({ type: Object }) // BYPASS-TYPING-TEST
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find All Shipments',
    description: 'Retrieve a list of shipments globally.',
  })
  @ApiFieldMask()
  async findAll(
    @Query('days') days?: string,
    @Query('salesOrderId') salesOrderId?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.shipmentService.findAll({
      days: days ? parseInt(days, 10) : undefined,
      salesOrderId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data };
  }

  @Get(':id')
  @ApiOkResponse({ type: Object }) // BYPASS-TYPING-TEST
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find Shipment',
    description: 'Retrieve detailed information for a specific shipment.',
  })
  @ApiFieldMask()
  async findOne(@Param('id') id: string) {
    return this.shipmentService.findOne(id);
  }
}

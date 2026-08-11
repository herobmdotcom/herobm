import { SystemResource } from '@herobm/shared';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { ShipmentsCoreService } from './shipments/shipments-core.service';
import { ShipmentsWriteService } from './shipments/shipments-write.service';
import { ShipmentResponseDto } from './dto';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('Warehouse')
@Controller('shipments')
@CasbinResource(SystemResource.SALES_ORDERS)
export class GlobalShipmentsController {
  constructor(
    private readonly shipmentsCoreService: ShipmentsCoreService,
    private readonly shipmentsWriteService: ShipmentsWriteService,
  ) {}

  @Get()
  @ApiOkResponse({ type: [ShipmentResponseDto] })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find All Shipments',
    description: 'Retrieve a list of shipments globally.',
  })
  @ApiFieldMask()
  @ApiQuery({ name: 'days', required: false })
  @ApiQuery({ name: 'salesOrderId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(
    @Query('days') days?: string,
    @Query('salesOrderId') salesOrderId?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.shipmentsCoreService.findAll({
      days: days ? parseInt(days, 10) : undefined,
      salesOrderId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return data;
  }

  @Get(':id')
  @ApiOkResponse({ type: ShipmentResponseDto })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find Shipment',
    description: 'Retrieve detailed information for a specific shipment.',
  })
  @ApiFieldMask()
  async findOne(@Param('id') id: string) {
    return this.shipmentsCoreService.findOne(id);
  }
}

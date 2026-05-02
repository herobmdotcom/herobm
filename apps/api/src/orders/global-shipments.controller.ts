import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CasbinGuard, CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { ShipmentService } from './shipment.service';

@Controller('shipments')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('sales-orders')
export class GlobalShipmentsController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Get()
  @CasbinAction('read')
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
  @CasbinAction('read')
  async findOne(@Param('id') id: string) {
    return this.shipmentService.findOne(id);
  }
}

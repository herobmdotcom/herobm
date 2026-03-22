import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InventoryService } from './inventory.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { PaginationQuery } from '../common/pagination';

@Controller('inventory')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @CasbinAction('read')
  findAll(
    @Query() query: PaginationQuery,
    @Query('locationNo') locationNo?: string,
  ) {
    return this.inventoryService.findAll({ ...query, locationNo });
  }

  @Get('by-products')
  @CasbinAction('read')
  findByProductIds(@Query('productIds') productIds?: string) {
    const ids = productIds
      ? productIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : [];
    return this.inventoryService.findByProductIds(ids);
  }

  @Get('bins')
  @CasbinAction('read')
  findBins(
    @Query() query: PaginationQuery,
    @Query('locationNo') locationNo?: string,
  ) {
    return this.inventoryService.findBins({ ...query, locationNo });
  }

  @Get('movements')
  @CasbinAction('read')
  getMovements(@Query('days') days?: string) {
    const daysInt = parseInt(days || '30', 10);
    return this.inventoryService.getMovements(isNaN(daysInt) ? 30 : daysInt);
  }
}

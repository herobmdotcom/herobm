import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { PaginationQuery } from '../common/pagination';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@UseGuards(AuthGuard('jwt'), CasbinGuard)
@Controller('suppliers')
@CasbinResource('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @CasbinAction('read')
  async findAll(@Query() query: PaginationQuery) {
    return this.suppliersService.findAll(query);
  }

  @Get('by-product/:productId')
  @CasbinAction('read')
  async findByProduct(@Param('productId') productId: string) {
    return this.suppliersService.findProductSuppliers(productId);
  }

  @Get(':id')
  @CasbinAction('read')
  async findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Get(':id/products')
  @CasbinAction('read')
  async findSupplierProducts(@Param('id') id: string) {
    return this.suppliersService.findSupplierProducts(id);
  }
}

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SuppliersService, SupplierSearchParams } from './suppliers.service';
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
  constructor(private readonly suppliersService: SuppliersService) { }

  @Get()
  @CasbinAction('read')
  async findAll(@Query() query: SupplierSearchParams) {
    return this.suppliersService.findAll(query);
  }

  @Get(':id')
  @CasbinAction('read')
  async findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }
}

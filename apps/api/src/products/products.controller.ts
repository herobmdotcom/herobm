import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProductsService } from './products.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { PaginationQuery } from '../common/pagination';

@Controller('products')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @CasbinAction('read')
  findAll(@Query() query: PaginationQuery) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  @CasbinAction('read')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }
}

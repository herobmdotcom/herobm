import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Post,
  Patch,
  Body,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProductsService } from './products.service';
import { ProductsWriteService } from './products-write.service';
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
  constructor(
    private readonly productsService: ProductsService,
    private readonly productsWriteService: ProductsWriteService,
  ) {}

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

  @Post()
  @CasbinAction('write')
  create(@Body() dto: any, @Req() req: any) {
    return this.productsWriteService.create(dto, req.user.username);
  }

  @Patch(':id')
  @CasbinAction('write')
  update(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.productsWriteService.update(id, dto, req.user.username);
  }
}

import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Post,
  Patch,
  Body,
  Delete,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProductsService } from './products.service';
import { ProductsWriteService } from './products-write.service';
import { AddSupplierDto } from './dto';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { PaginationQuery } from '../common/pagination';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

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
  create(@Body() dto: any, @AuthUser() user: JwtUser) {
    return this.productsWriteService.create(dto, user.username);
  }

  @Patch(':id')
  @CasbinAction('write')
  update(@Param('id') id: string, @Body() dto: any, @AuthUser() user: JwtUser) {
    return this.productsWriteService.update(id, dto, user.username);
  }

  @Post(':id/archive')
  @CasbinAction('archive')
  archive(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.productsWriteService.archive(id, user.username);
  }

  @Post(':id/unarchive')
  @CasbinAction('archive')
  unarchive(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.productsWriteService.unarchive(id, user.username);
  }

  @Post(':id/suppliers')
  @CasbinAction('write')
  addSupplier(
    @Param('id') productId: string,
    @Body() dto: AddSupplierDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.addSupplier(productId, dto, user.username);
  }

  @Delete(':id/suppliers/:vendorId')
  @CasbinAction('write')
  removeSupplier(
    @Param('id') productId: string,
    @Param('vendorId') vendorId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.removeSupplier(
      productId,
      vendorId,
      user.username,
    );
  }
}

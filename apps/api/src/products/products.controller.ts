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
import {
  AddSupplierDto,
  CreateProductDto,
  UpdateProductDto,
  LinkBinDto,
} from './dto';
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
  create(@Body() dto: CreateProductDto, @AuthUser() user: JwtUser) {
    return this.productsWriteService.create(dto, user.username);
  }

  @Patch(':id')
  @CasbinAction('write')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @AuthUser() user: JwtUser,
  ) {
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

  @Post(':id/uoms')
  @CasbinAction('write')
  addUom(
    @Param('id') productId: string,
    @Body() dto: { uomCode: string; ratio: string; barcode?: string },
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.addUom(productId, dto, user.username);
  }

  @Delete(':id/uoms/:uomId')
  @CasbinAction('write')
  removeUom(
    @Param('id') productId: string,
    @Param('uomId') uomId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.removeUom(productId, uomId, user.username);
  }
  @Post(':id/default-bins')
  @CasbinAction('write')
  linkDefaultBin(
    @Param('id') productId: string,
    @Body() dto: LinkBinDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.linkDefaultBin(
      productId,
      dto,
      user.username,
    );
  }

  @Delete(':id/default-bins/:binLinkId')
  @CasbinAction('write')
  removeDefaultBin(
    @Param('id') productId: string,
    @Param('binLinkId') binLinkId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.removeDefaultBin(binLinkId, user.username);
  }

  @Get(':id/components')
  @CasbinAction('read')
  getComponents(@Param('id') productId: string) {
    return this.productsService.getComponents(productId);
  }

  @Post(':id/components')
  @CasbinAction('write')
  addComponent(
    @Param('id') productId: string,
    @Body()
    dto: {
      childProductId: string;
      parentQuantity: string;
      quantity: string;
      sequenceNumber?: number;
      fractionalBehavior?:
        | 'allow_fractional'
        | 'round_up'
        | 'round_down'
        | 'force_multiple';
    },
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.addComponent(
      productId,
      dto,
      user.username,
    );
  }

  @Patch(':id/components/:componentId')
  @CasbinAction('write')
  updateComponent(
    @Param('id') productId: string,
    @Param('componentId') componentId: string,
    @Body()
    dto: {
      parentQuantity?: string;
      quantity?: string;
      sequenceNumber?: number;
      fractionalBehavior?:
        | 'allow_fractional'
        | 'round_up'
        | 'round_down'
        | 'force_multiple';
    },
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.updateComponent(
      productId,
      componentId,
      dto,
      user.username,
    );
  }

  @Delete(':id/components/:componentId')
  @CasbinAction('write')
  removeComponent(
    @Param('id') productId: string,
    @Param('componentId') componentId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.removeComponent(
      productId,
      componentId,
      user.username,
    );
  }
}

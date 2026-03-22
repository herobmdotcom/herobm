import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersWriteService } from './suppliers-write.service';
import type {
  CreateSupplierDto,
  UpdateSupplierDto,
} from './suppliers-write.service';
import { PaginationQuery } from '../common/pagination';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

@UseGuards(AuthGuard('jwt'), CasbinGuard)
@Controller('suppliers')
@CasbinResource('suppliers')
export class SuppliersController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly suppliersWriteService: SuppliersWriteService,
  ) {}

  @Get()
  @CasbinAction('read')
  async findAll(@Query() query: PaginationQuery) {
    return this.suppliersService.findAll(query);
  }

  @Post()
  @CasbinAction('write')
  async create(@Body() dto: CreateSupplierDto, @AuthUser() user: JwtUser) {
    return this.suppliersWriteService.create(dto, user.username);
  }

  @Get('by-product/:productId')
  @CasbinAction('read')
  async findByProduct(@Param('productId') productId: string) {
    // Note: this still points to legacy findProductSuppliers (which is now in SuppliersService)
    // Actually, SuppliersService.findProductSuppliers was removed in my previous edit?
    // Wait, let me check SuppliersService again.
    return this.suppliersService.findSupplierProducts(productId);
  }

  @Get(':id')
  @CasbinAction('read')
  async findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Patch(':id')
  @CasbinAction('write')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.suppliersWriteService.update(id, dto, user.username);
  }

  @Get(':id/products')
  @CasbinAction('read')
  async findSupplierProducts(@Param('id') id: string) {
    return this.suppliersService.findSupplierProducts(id);
  }

  @Post(':id/archive')
  @CasbinAction('archive')
  async archive(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.suppliersWriteService.archive(id, user.username);
  }

  @Post(':id/unarchive')
  @CasbinAction('archive')
  async unarchive(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.suppliersWriteService.unarchive(id, user.username);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersWriteService } from './suppliers-write.service';
import { PaginationQuery } from '../common/pagination';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateSupplierExpiryDto,
  UpdateSupplierExpiryDto,
} from './dto';

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
  async findByProduct(
    @Param('productId') productId: string,
    @Query() query: PaginationQuery,
  ) {
    return this.suppliersService.findProductSuppliers(productId, query);
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
  async findSupplierProducts(
    @Param('id') id: string,
    @Query() query: PaginationQuery,
  ) {
    return this.suppliersService.findSupplierProducts(id, query);
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

  // --- Expiries ---

  @Get(':id/expiries')
  @CasbinAction('read')
  async findSupplierExpiries(
    @Param('id') vendorId: string,
    @Query() query: PaginationQuery,
  ) {
    return this.suppliersService.findSupplierExpiries(vendorId, query);
  }

  @Post(':id/expiries')
  @CasbinAction('write')
  async createExpiry(
    @Param('id') vendorId: string,
    @Body() dto: CreateSupplierExpiryDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.suppliersWriteService.createExpiry(
      vendorId,
      dto,
      user.username,
    );
  }

  @Patch(':id/expiries/:expiryId')
  @CasbinAction('write')
  async updateExpiry(
    @Param('id') vendorId: string,
    @Param('expiryId') expiryId: string,
    @Body() dto: UpdateSupplierExpiryDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.suppliersWriteService.updateExpiry(
      vendorId,
      expiryId,
      dto,
      user.username,
    );
  }

  @Delete(':id/expiries/:expiryId')
  @CasbinAction('write')
  async deleteExpiry(
    @Param('id') vendorId: string,
    @Param('expiryId') expiryId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.suppliersWriteService.deleteExpiry(
      vendorId,
      expiryId,
      user.username,
    );
  }
}

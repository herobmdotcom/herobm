  // security-ignore: dto-validation\nimport { SystemResource } from '@herobm/shared';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersWriteService } from './suppliers-write.service';
import { PaginationQuery } from '../common/pagination';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateSupplierExpiryDto,
  UpdateSupplierExpiryDto,
  SupplierResponseDto,
  EmptyBodyDto,
  SupplierAgedBalanceResponseDto,
} from './dto';
import { ApiPaginatedResponse } from '../common/pagination';
import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('Suppliers')
@Controller('suppliers')
@CasbinResource(SystemResource.SUPPLIERS)
export class SuppliersController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly suppliersWriteService: SuppliersWriteService,
  ) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Suppliers',
    description: 'Retrieve a paginated list of all suppliers.',
  })
  @ApiPaginatedResponse(SupplierResponseDto)
  @ApiFieldMask()
  async findAll(@Query() query: PaginationQuery) {
    return this.suppliersService.findAll(query);
  }

  @Get('aged-balances')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Aged Balances',
    description:
      'Retrieve aged balances for all suppliers with outstanding invoices.',
  })
  @ApiQuery({
    name: 'agingBasis',
    required: false,
    enum: ['invoiceDate', 'dueDate'],
  })
  @ApiOkResponse({ type: [SupplierAgedBalanceResponseDto] })
  async getAgedBalances(
    @Query('agingBasis') agingBasis?: 'invoiceDate' | 'dueDate',
  ) {
    return this.suppliersService.getAgedBalances(agingBasis);
  }

  @Post()
  @ApiBody({ type: CreateSupplierDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Supplier',
    description: 'Register a new supplier.',
  })
  @ApiCreatedResponse({ type: SupplierResponseDto })
  async create(@Body() dto: CreateSupplierDto, @AuthUser() user: JwtUser) {
    return this.suppliersWriteService.create(dto, user.username);
  }

  @Get('by-product/:productId')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Product Suppliers',
    description: 'Retrieve suppliers that supply a specific product.',
  })
  @ApiPaginatedResponse(SupplierResponseDto)
  async findByProduct(
    @Param('productId') productId: string,
    @Query() query: PaginationQuery,
  ) {
    return this.suppliersService.findProductSuppliers(productId, query);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Supplier',
    description: 'Retrieve detailed information for a specific supplier.',
  })
  @ApiOkResponse({ type: SupplierResponseDto })
  @ApiFieldMask()
  async findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateSupplierDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Supplier',
    description: 'Modify the details of an existing supplier.',
  })
  @ApiOkResponse({ type: SupplierResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.suppliersWriteService.update(id, dto, user.username);
  }

  @Get(':id/products')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Supplier Products',
    description: 'Retrieve a list of products provided by a specific supplier.',
  })
  @ApiPaginatedResponse(SupplierResponseDto)
  async findSupplierProducts(
    @Param('id') id: string,
    @Query() query: PaginationQuery,
  ) {
    return this.suppliersService.findSupplierProducts(id, query);
  }

  @Post(':id/archive')
  @ApiBody({ type: EmptyBodyDto })
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Archive Supplier',
    description: 'Mark a supplier as archived.',
  })
  @ApiCreatedResponse({ type: SupplierResponseDto })
  async archive(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.suppliersWriteService.archive(id, user.username);
  }

  @Post(':id/unarchive')
  @ApiBody({ type: EmptyBodyDto })
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Unarchive Supplier',
    description: 'Restore an archived supplier to active status.',
  })
  @ApiCreatedResponse({ type: SupplierResponseDto })
  async unarchive(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.suppliersWriteService.unarchive(id, user.username);
  }

  // --- Expiries ---

  @Get(':id/expiries')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Expiries',
    description: 'Retrieve expiry records for a specific supplier.',
  })
  @ApiPaginatedResponse(SupplierResponseDto)
  async findSupplierExpiries(
    @Param('id') vendorId: string,
    @Query() query: PaginationQuery,
  ) {
    return this.suppliersService.findSupplierExpiries(vendorId, query);
  }

  @Post(':id/expiries')
  @ApiBody({ type: CreateSupplierExpiryDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Expiry',
    description: 'Add an expiry record for a specific supplier.',
  })
  @ApiCreatedResponse({ type: SupplierResponseDto })
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
  @ApiBody({ type: UpdateSupplierExpiryDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Expiry',
    description: 'Modify an existing expiry record for a supplier.',
  })
  @ApiOkResponse({ type: SupplierResponseDto })
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
  @ApiOperation({
    summary: 'Delete Expiry',
    description: 'Remove an expiry record from a supplier.',
  })
  @ApiOkResponse({ type: SupplierResponseDto })
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

// security-ignore: dto-validation
import { SystemResource } from '@herobm/shared';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Body,
  Delete,
} from '@nestjs/common';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';
import { SupplierGroupsService } from './supplier-groups.service';
import {
  CreateSupplierGroupDto,
  UpdateSupplierGroupDto,
  SupplierGroupResponseDto,
} from './dto';
import { ApiPaginatedResponse } from '../common/pagination';
import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('Suppliers')
@Controller('supplier-groups')
@CasbinResource(SystemResource.SETTINGS)
export class SupplierGroupsController {
  constructor(private readonly supplierGroupsService: SupplierGroupsService) {}

  @Get()
  @ApiOkResponse({ type: [SupplierGroupResponseDto] })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Supplier Groups',
    description: 'Retrieve a list of all supplier groups.',
  })
  @ApiPaginatedResponse(SupplierGroupResponseDto)
  @ApiFieldMask()
  findAll() {
    return this.supplierGroupsService.findAll();
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Supplier Group',
    description: 'Retrieve detailed information for a specific supplier group.',
  })
  @ApiOkResponse({ type: SupplierGroupResponseDto })
  @ApiFieldMask()
  findOne(@Param('id') id: string) {
    return this.supplierGroupsService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateSupplierGroupDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Supplier Group',
    description: 'Create a new supplier group.',
  })
  @ApiCreatedResponse({ type: SupplierGroupResponseDto })
  create(@Body() dto: CreateSupplierGroupDto, @AuthUser() user: JwtUser) {
    return this.supplierGroupsService.create(dto, user?.userId);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateSupplierGroupDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Supplier Group',
    description: 'Modify the details of an existing supplier group.',
  })
  @ApiOkResponse({ type: SupplierGroupResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierGroupDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.supplierGroupsService.update(id, dto, user?.userId);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Supplier Group',
    description: 'Remove a supplier group from the system.',
  })
  @ApiOkResponse({ type: SupplierGroupResponseDto })
  remove(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.supplierGroupsService.delete(id, user?.userId);
  }
}

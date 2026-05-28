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
  UseGuards,
  Post,
  Patch,
  Body,
  Delete,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { ProductGroupsService } from './product-groups.service';
import {
  CreateProductGroupDto,
  UpdateProductGroupDto,
  ProductGroupResponseDto,
} from './dto';
import { ApiPaginatedResponse } from '../common/pagination';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('Setup')
@Controller('product-groups')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource('settings')
export class ProductGroupsController {
  constructor(private readonly productGroupsService: ProductGroupsService) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Product Groups',
    description: 'Retrieve all product groups configured in the system.',
  })
  @ApiPaginatedResponse(ProductGroupResponseDto)
  @ApiFieldMask()
  findAll() {
    return this.productGroupsService.findAll();
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Product Group',
    description: 'Retrieve details of a specific product group.',
  })
  @ApiOkResponse({ type: ProductGroupResponseDto })
  @ApiFieldMask()
  findOne(@Param('id') id: string) {
    return this.productGroupsService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateProductGroupDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Product Group',
    description: 'Create a new product group for categorizing items.',
  })
  @ApiCreatedResponse({ type: ProductGroupResponseDto })
  create(@Body() dto: CreateProductGroupDto) {
    return this.productGroupsService.create(dto);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateProductGroupDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Product Group',
    description: 'Modify an existing product group.',
  })
  @ApiOkResponse({ type: ProductGroupResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateProductGroupDto) {
    return this.productGroupsService.update(id, dto);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Product Group',
    description: 'Remove a product group from the system.',
  })
  @ApiOkResponse({ type: ProductGroupResponseDto })
  remove(@Param('id') id: string) {
    return this.productGroupsService.delete(id);
  }
}

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
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';
import { TaxCategoriesService } from './tax-categories.service';
import {
  CreateTaxCategoryDto,
  UpdateTaxCategoryDto,
  TaxCategoryResponseDto,
} from './dto';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('Tax')
@Controller('tax-categories')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.SETTINGS)
export class TaxCategoriesController {
  constructor(private readonly taxService: TaxCategoriesService) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Tax Categories',
    description: 'Retrieve a list of all tax categories.',
  })
  @ApiOkResponse({ type: [TaxCategoryResponseDto] })
  @ApiFieldMask()
  findAll() {
    return this.taxService.findAll();
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Tax Category',
    description: 'Retrieve detailed information about a specific tax category.',
  })
  @ApiOkResponse({ type: TaxCategoryResponseDto })
  @ApiFieldMask()
  findOne(@Param('id') id: string) {
    return this.taxService.getById(id);
  }

  @Post()
  @ApiBody({ type: CreateTaxCategoryDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Tax Category',
    description: 'Add a new tax category to the system.',
  })
  @ApiCreatedResponse({ type: TaxCategoryResponseDto })
  create(@Body() dto: CreateTaxCategoryDto, @AuthUser() user: JwtUser) {
    return this.taxService.create(dto, user?.userId);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateTaxCategoryDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Tax Category',
    description: 'Modify the details of an existing tax category.',
  })
  @ApiOkResponse({ type: TaxCategoryResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaxCategoryDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.taxService.update(id, dto, user?.userId);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Tax Category',
    description: 'Remove a tax category from the system.',
  })
  @ApiOkResponse({ type: TaxCategoryResponseDto })
  remove(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.taxService.delete(id, user?.userId);
  }
}

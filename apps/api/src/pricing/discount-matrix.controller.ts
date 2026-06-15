import { SystemResource } from '@herobm/shared';
import {
  ApiTags,
  ApiBearerAuth,
  ApiProperty,
  ApiConsumes,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { DiscountMatrixService } from './discount-matrix.service';
import {
  CreateDiscountMatrixDto,
  UpdateDiscountMatrixDto,
  DiscountMatrixResponseDto,
  ResolveDiscountRuleDto,
} from './dto';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('System')
@ApiBearerAuth()
@Controller('discount-matrix')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.SETTINGS)
export class DiscountMatrixController {
  constructor(private readonly service: DiscountMatrixService) {}

  /**
   * List discount rules, filtered by query params.
   * GET /api/discount-matrix?customerGroupId=...
   * GET /api/discount-matrix?customerId=...
   */
  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Rules',
    description: 'Retrieve discount rules based on query filters.',
  })
  @ApiOkResponse({ type: [DiscountMatrixResponseDto] })
  @ApiFieldMask()
  @ApiQuery({ name: 'customerGroupId', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'ownerType', required: false })
  async list(
    @Query('customerGroupId') customerGroupId?: string,
    @Query('customerId') customerId?: string,
    @Query('ownerType') ownerType?: 'customer' | 'account_group',
  ) {
    if (customerGroupId) {
      return this.service.findByAccountGroup(customerGroupId);
    }
    if (customerId) {
      return this.service.findByAccount(customerId);
    }
    if (ownerType === 'account_group') {
      return this.service.findAllAccountGroupRules();
    }
    if (ownerType === 'customer') {
      return this.service.findAllAccountRules();
    }
    return this.service.findAll();
  }

  /**
   * Get the fully resolved discount rules for a specific customer
   * (includes customer-level AND group-level rules, tagged with ownerType).
   * GET /api/discount-matrix/resolve?customerId=...&customerGroupId=...
   */
  @Get('resolve')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Resolve Rules',
    description:
      'Retrieve the fully resolved discount rules for a specific customer.',
  })
  @ApiOkResponse({ type: [ResolveDiscountRuleDto] })
  @ApiQuery({ name: 'customerGroupId', required: false })
  async resolve(
    @Query('customerId') customerId: string,
    @Query('customerGroupId') customerGroupId?: string,
  ) {
    if (!customerId) {
      throw new BadRequestException('customerId query parameter is required.');
    }
    return this.service.resolveRulesForAccount(
      customerId,
      customerGroupId || null,
    );
  }

  @Post()
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Rule',
    description: 'Add a new discount rule to the matrix.',
  })
  @ApiCreatedResponse({ type: DiscountMatrixResponseDto })
  async create(@Body() dto: CreateDiscountMatrixDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Rule',
    description: 'Modify an existing discount rule.',
  })
  @ApiOkResponse({ type: DiscountMatrixResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdateDiscountMatrixDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Rule',
    description: 'Remove a discount rule from the matrix.',
  })
  @ApiOkResponse({
    // BYPASS-TYPING-TEST
    schema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean' },
      },
    },
  })
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}

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
import { CreateDiscountMatrixDto, UpdateDiscountMatrixDto } from './dto';

@Controller('discount-matrix')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class DiscountMatrixController {
  constructor(private readonly service: DiscountMatrixService) {}

  /**
   * List discount rules, filtered by query params.
   * GET /api/discount-matrix?accountGroupId=...
   * GET /api/discount-matrix?accountId=...
   */
  @Get()
  @CasbinAction('read')
  async list(
    @Query('accountGroupId') accountGroupId?: string,
    @Query('accountId') accountId?: string,
    @Query('ownerType') ownerType?: 'account' | 'account_group',
  ) {
    if (accountGroupId) {
      return this.service.findByAccountGroup(accountGroupId);
    }
    if (accountId) {
      return this.service.findByAccount(accountId);
    }
    if (ownerType === 'account_group') {
      return this.service.findAllAccountGroupRules();
    }
    if (ownerType === 'account') {
      return this.service.findAllAccountRules();
    }
    return this.service.findAll();
  }

  /**
   * Get the fully resolved discount rules for a specific account
   * (includes account-level AND group-level rules, tagged with ownerType).
   * GET /api/discount-matrix/resolve?accountId=...&accountGroupId=...
   */
  @Get('resolve')
  @CasbinAction('read')
  async resolve(
    @Query('accountId') accountId: string,
    @Query('accountGroupId') accountGroupId?: string,
  ) {
    if (!accountId) {
      throw new BadRequestException('accountId query parameter is required.');
    }
    return this.service.resolveRulesForAccount(
      accountId,
      accountGroupId || null,
    );
  }

  @Post()
  @CasbinAction('write')
  async create(@Body() dto: CreateDiscountMatrixDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @CasbinAction('write')
  async update(@Param('id') id: string, @Body() dto: UpdateDiscountMatrixDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @CasbinAction('write')
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}

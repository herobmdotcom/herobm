import { SystemResource } from '@modbm/shared';
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Post,
  Patch,
  Body,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AccountsService } from './customers.service';
import { AccountsWriteService } from './customers-write.service';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { PaginationQuery, ApiPaginatedResponse } from '../common/pagination';
import {
  CreateAccountDto,
  UpdateAccountDto,
  EmptyBodyDto,
  AccountResponseDto,
} from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('Customers')
@Controller('customers')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.CUSTOMERS)
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly accountsWriteService: AccountsWriteService,
  ) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Customers',
    description: 'Retrieve a paginated list of customers.',
  })
  @ApiFieldMask()
  @ApiPaginatedResponse(AccountResponseDto)
  findAll(@Query() query: PaginationQuery) {
    return this.accountsService.findAll(query);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Customer',
    description: 'Retrieve a single customer by ID.',
  })
  @ApiFieldMask()
  @ApiOkResponse({ type: AccountResponseDto })
  findOne(@Param('id') id: string) {
    return this.accountsService.findOne(id);
  }

  @Post()
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Customer',
    description: 'Create a new customer.',
  })
  @ApiCreatedResponse({ type: AccountResponseDto })
  create(@Body() dto: CreateAccountDto, @AuthUser() user: JwtUser) {
    return this.accountsWriteService.create(dto, user.username);
  }

  @Patch(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Customer',
    description: 'Update an existing customer.',
  })
  @ApiOkResponse({ type: AccountResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.accountsWriteService.update(id, dto, user.username);
  }

  @Post(':id/archive')
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Archive Customer',
    description: 'Archive a customer.',
  })
  @ApiCreatedResponse({ type: AccountResponseDto })
  archive(
    @Param('id') id: string,
    @Body() body: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.accountsWriteService.archive(id, user.username);
  }

  @Post(':id/unarchive')
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Unarchive Customer',
    description: 'Unarchive a customer.',
  })
  @ApiCreatedResponse({ type: AccountResponseDto })
  unarchive(
    @Param('id') id: string,
    @Body() body: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.accountsWriteService.unarchive(id, user.username);
  }
}

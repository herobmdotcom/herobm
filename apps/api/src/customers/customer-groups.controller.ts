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
import { AccountGroupsService } from './customer-groups.service';
import {
  CreateAccountGroupDto,
  UpdateAccountGroupDto,
  AccountGroupResponseDto,
} from './dto';

@ApiTags('Setup')
@Controller('customer-groups')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class AccountGroupsController {
  constructor(private readonly accountGroupsService: AccountGroupsService) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Customer Groups',
    description: 'Retrieve a list of all customer groups.',
  })
  @ApiOkResponse({ type: [AccountGroupResponseDto] })
  findAll() {
    return this.accountGroupsService.findAll();
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Customer Group',
    description:
      'Retrieve detailed information about a specific customer group.',
  })
  @ApiOkResponse({ type: AccountGroupResponseDto })
  findOne(@Param('id') id: string) {
    return this.accountGroupsService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateAccountGroupDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Customer Group',
    description: 'Add a new customer group to the system.',
  })
  @ApiCreatedResponse({ type: AccountGroupResponseDto })
  create(@Body() dto: CreateAccountGroupDto) {
    return this.accountGroupsService.create(dto);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateAccountGroupDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Customer Group',
    description: 'Modify the details of an existing customer group.',
  })
  @ApiOkResponse({ type: AccountGroupResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateAccountGroupDto) {
    return this.accountGroupsService.update(id, dto);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Customer Group',
    description: 'Remove a customer group from the system.',
  })
  @ApiOkResponse({
    schema: { type: 'object', properties: { deleted: { type: 'boolean' } } },
  })
  remove(@Param('id') id: string) {
    return this.accountGroupsService.delete(id);
  }
}

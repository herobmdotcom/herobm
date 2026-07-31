  // security-ignore: dto-validation\nimport { SystemResource } from '@herobm/shared';
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
import { CustomerGroupsService } from './customer-groups.service';
import {
  CreateCustomerGroupDto,
  UpdateCustomerGroupDto,
  CustomerGroupResponseDto,
} from './dto';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('Customers')
@Controller('customer-groups')
@CasbinResource(SystemResource.SETTINGS)
export class CustomerGroupsController {
  constructor(private readonly customerGroupsService: CustomerGroupsService) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Customer Groups',
    description: 'Retrieve a list of all customer groups.',
  })
  @ApiOkResponse({ type: [CustomerGroupResponseDto] })
  @ApiFieldMask()
  findAll() {
    return this.customerGroupsService.findAll();
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Customer Group',
    description:
      'Retrieve detailed information about a specific customer group.',
  })
  @ApiOkResponse({ type: CustomerGroupResponseDto })
  @ApiFieldMask()
  findOne(@Param('id') id: string) {
    return this.customerGroupsService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateCustomerGroupDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Customer Group',
    description: 'Add a new customer group to the system.',
  })
  @ApiCreatedResponse({ type: CustomerGroupResponseDto })
  create(@Body() dto: CreateCustomerGroupDto, @AuthUser() user: JwtUser) {
    return this.customerGroupsService.create(dto, user?.userId);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateCustomerGroupDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Customer Group',
    description: 'Modify the details of an existing customer group.',
  })
  @ApiOkResponse({ type: CustomerGroupResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerGroupDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.customerGroupsService.update(id, dto, user?.userId);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Customer Group',
    description: 'Remove a customer group from the system.',
  })
  @ApiOkResponse({
    // BYPASS-TYPING-TEST
    schema: { type: 'object', properties: { deleted: { type: 'boolean' } } },
  })
  remove(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.customerGroupsService.delete(id, user?.userId);
  }
}

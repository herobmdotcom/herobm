  // security-ignore: dto-validation
import { SystemResource } from '@herobm/shared';
import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  Patch,
  Body,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersWriteService } from './customers-write.service';
import { CreditAssessmentService } from './credit-assessment.service';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { PaginationQuery, ApiPaginatedResponse } from '../common/pagination';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerResponseDto,
  CreditAssessmentResponseDto,
  AgedBalanceResponseDto,
} from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiQuery,
} from '@nestjs/swagger';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('Customers')
@Controller('customers')
@CasbinResource(SystemResource.CUSTOMERS)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly customersWriteService: CustomersWriteService,
    private readonly creditAssessmentService: CreditAssessmentService,
  ) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Customers',
    description: 'Retrieve a paginated list of customers.',
  })
  @ApiFieldMask()
  @ApiPaginatedResponse(CustomerResponseDto)
  findAll(@Query() query: PaginationQuery) {
    return this.customersService.findAll(query);
  }

  @Get('aged-balances')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Aged Balances',
    description:
      'Retrieve aged balances for all customers with outstanding invoices.',
  })
  @ApiQuery({
    name: 'agingBasis',
    required: false,
    enum: ['invoiceDate', 'dueDate'],
  })
  @ApiOkResponse({ type: [AgedBalanceResponseDto] })
  getAgedBalances(@Query('agingBasis') agingBasis?: 'invoiceDate' | 'dueDate') {
    return this.customersService.getAgedBalances(agingBasis);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Customer',
    description: 'Retrieve a single customer by ID.',
  })
  @ApiFieldMask()
  @ApiOkResponse({ type: CustomerResponseDto })
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Get(':id/credit-assessment')
  @CasbinResource(SystemResource.CREDIT_CONTROL)
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Credit Assessment',
    description: 'Retrieve the credit assessment for a customer.',
  })
  @ApiOkResponse({ type: CreditAssessmentResponseDto })
  getCreditAssessment(@Param('id') id: string) {
    return this.creditAssessmentService.assessCredit(id);
  }

  @Post()
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Customer',
    description: 'Create a new customer.',
  })
  @ApiCreatedResponse({ type: CustomerResponseDto })
  create(@Body() dto: CreateCustomerDto, @AuthUser() user: JwtUser) {
    return this.customersWriteService.create(dto, user.username);
  }

  @Patch(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Customer',
    description: 'Update an existing customer.',
  })
  @ApiOkResponse({ type: CustomerResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.customersWriteService.update(id, dto, user.username, user.role);
  }

  @Post(':id/archive')
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Archive Customer',
    description: 'Archive a customer.',
  })
  @ApiCreatedResponse({ type: CustomerResponseDto })
  archive(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.customersWriteService.archive(id, user.username);
  }

  @Post(':id/unarchive')
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Unarchive Customer',
    description: 'Unarchive a customer.',
  })
  @ApiCreatedResponse({ type: CustomerResponseDto })
  unarchive(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.customersWriteService.unarchive(id, user.username);
  }
}

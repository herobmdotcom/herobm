import { SystemResource } from '@modbm/shared';
import {
  ApiTags,
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
  Body,
  Param,
  UseGuards,
  Patch,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Idempotent } from '../common/idempotency/idempotent.decorator';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentDto,
  AllocatePaymentDto,
  BatchPaymentActionDto,
  PaymentResponseDto,
  ExportAbaResponseDto,
  ConfirmRejectResponseDto,
  EmptyBodyDto,
} from './dto';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { AuthUser } from '../auth/auth-user.decorator';
import { ApiPaginatedResponse } from '../common/pagination';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.PAYMENTS)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find All Payments',
    description:
      'Retrieve a list of payments with optional filters for days and allocation status.',
  })
  @ApiPaginatedResponse(PaymentResponseDto)
  @ApiFieldMask()
  @ApiQuery({ name: 'days', required: false })
  @ApiQuery({ name: 'allocation', required: false })
  findAll(
    @Query('days') days?: string,
    @Query('allocation') allocation?: string,
  ) {
    return this.paymentsService.findAll(days, allocation);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find Payment',
    description: 'Retrieve detailed information for a specific payment.',
  })
  @ApiOkResponse({ type: PaymentResponseDto })
  @ApiFieldMask()
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreatePaymentDto })
  @CasbinAction('write')
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    queryKey: 'payments',
    pkField: 'paymentId',
    idBodyPath: 'paymentId',
  })
  @ApiOperation({
    summary: 'Create Payment',
    description: 'Create a new payment entry.',
  })
  @ApiCreatedResponse({ type: PaymentResponseDto })
  async create(
    @Body() dto: CreatePaymentDto,
    @AuthUser() user: { username: string },
  ) {
    return this.paymentsService.createPaymentEntry(dto, user.username);
  }

  @Patch(':id/submit')
  @ApiBody({ type: EmptyBodyDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Submit Payment',
    description: 'Submit a draft payment for processing.',
  })
  @ApiOkResponse({ type: PaymentResponseDto })
  async submit(
    @Param('id') id: string,
    @Body() body: EmptyBodyDto,
    @AuthUser() user: { username: string },
  ) {
    return this.paymentsService.submitPaymentEntry(id, user.username);
  }

  @Patch(':id/allocate')
  @ApiBody({ type: AllocatePaymentDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Allocate Payment',
    description: 'Allocate a payment to an invoice or bill.',
  })
  @ApiOkResponse({ type: PaymentResponseDto })
  async allocate(
    @Param('id') id: string,
    @Body() dto: AllocatePaymentDto,
    @AuthUser() user: { username: string },
  ) {
    return this.paymentsService.allocatePayment(id, dto, user.username);
  }

  @Patch(':id/cancel')
  @ApiBody({ type: EmptyBodyDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Cancel Payment',
    description: 'Cancel an open payment.',
  })
  @ApiOkResponse({ type: PaymentResponseDto })
  async cancel(
    @Param('id') id: string,
    @Body() body: EmptyBodyDto,
    @AuthUser() user: { username: string },
  ) {
    return this.paymentsService.cancelPayment(id, user.username);
  }

  @Post('export-aba')
  @ApiBody({ type: BatchPaymentActionDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Export ABA',
    description: 'Export selected payments into an ABA file format.',
  })
  @ApiCreatedResponse({ type: ExportAbaResponseDto }) // Uses same response DTO
  async exportAba(
    @Body() dto: BatchPaymentActionDto,
    @AuthUser() user: { username: string },
  ) {
    const fileContent = await this.paymentsService.exportAba(
      dto.paymentIds,
      user.username,
    );
    return { fileContent }; // Return as json for the frontend to blobify
  }

  @Post('export-nacha')
  @ApiBody({ type: BatchPaymentActionDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Export NACHA',
    description: 'Export selected payments into a NACHA ACH file format.',
  })
  @ApiCreatedResponse({ type: ExportAbaResponseDto }) // Uses same response DTO { fileContent: string }
  async exportNacha(
    @Body() dto: BatchPaymentActionDto,
    @AuthUser() user: { username: string },
  ) {
    const fileContent = await this.paymentsService.exportNacha(
      dto.paymentIds,
      user.username,
    );
    return { fileContent };
  }

  @Post('confirm-exported')
  @ApiBody({ type: BatchPaymentActionDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Confirm Exported Payments',
    description: 'Mark a batch of exported payments as confirmed.',
  })
  @ApiCreatedResponse({ type: ConfirmRejectResponseDto })
  async confirmExported(
    @Body() dto: BatchPaymentActionDto,
    @AuthUser() user: { username: string },
  ) {
    return this.paymentsService.confirmExported(dto.paymentIds, user.username);
  }

  @Post('reject-exported')
  @ApiBody({ type: BatchPaymentActionDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Reject Exported Payments',
    description: 'Mark a batch of exported payments as rejected.',
  })
  @ApiCreatedResponse({ type: ConfirmRejectResponseDto })
  async rejectExported(
    @Body() dto: BatchPaymentActionDto,
    @AuthUser() user: { username: string },
  ) {
    return this.paymentsService.rejectExported(dto.paymentIds, user.username);
  }
}

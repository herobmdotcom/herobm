import { SystemResource } from '@herobm/shared';
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
  Patch,
  Query,
  UseInterceptors,
  Delete,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Idempotent } from '../common/idempotency/idempotent.decorator';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { PaymentsCoreService } from './payments-core.service';
import { PaymentsWriteService } from './payments-write.service';
import { PaymentsAllocationService } from './payments-allocation.service';
import { PaymentsPostingService } from './payments-posting.service';
import {
  CreatePaymentDto,
  AllocatePaymentDto,
  BatchPaymentActionDto,
  PaymentResponseDto,
  ExportAbaResponseDto,
  ConfirmRejectResponseDto,
  EmptyBodyDto,
  GeneratePaymentRunDto,
  GeneratePaymentRunResponseDto,
  PaymentRunCandidateResponseDto,
} from './dto';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { AuthUser } from '../auth/auth-user.decorator';
import { ApiPaginatedResponse } from '../common/pagination';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';
import { PaymentRunGeneratorService } from './payment-run-generator.service';

@ApiTags('Payments')
@Controller('payments')
@CasbinResource(SystemResource.PAYMENTS)
export class PaymentsController {
  constructor(
    @Inject(forwardRef(() => PaymentsCoreService))
    private readonly paymentsCoreService: PaymentsCoreService,
    @Inject(forwardRef(() => PaymentsWriteService))
    private readonly paymentsWriteService: PaymentsWriteService,
    @Inject(forwardRef(() => PaymentsAllocationService))
    private readonly paymentsAllocationService: PaymentsAllocationService,
    @Inject(forwardRef(() => PaymentsPostingService))
    private readonly paymentsPostingService: PaymentsPostingService,
    @Inject(forwardRef(() => PaymentRunGeneratorService))
    private readonly paymentRunGeneratorService: PaymentRunGeneratorService,
  ) {}

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
  @ApiQuery({ name: 'partyId', required: false })
  findAll(
    @Query('days') days?: string,
    @Query('allocation') allocation?: string,
    @Query('partyId') partyId?: string,
  ) {
    return this.paymentsCoreService.findAll(days, allocation, partyId);
  }

  @Get('run-candidates')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Payment Run Candidates',
    description: 'Fetch eligible invoices for a payment run on a target date.',
  })
  @ApiOkResponse({ type: [PaymentRunCandidateResponseDto] })
  @ApiQuery({ name: 'targetDate', required: true })
  async getPaymentRunCandidates(@Query('targetDate') targetDate: string) {
    return await this.paymentRunGeneratorService.getPaymentRunCandidates(
      targetDate,
    );
  }

  @ApiOperation({
    summary: 'Generate Payment Run',
    description:
      'Generates a new payment run batch for eligible supplier invoices.',
  })
  @Post('generate-run')
  @CasbinAction('write')
  @ApiCreatedResponse({ type: GeneratePaymentRunResponseDto })
  async generatePaymentRun(
    @Body() dto: GeneratePaymentRunDto,
    @AuthUser('userId') userId: string,
  ) {
    return await this.paymentRunGeneratorService.generatePaymentRun(
      dto.targetDate,
      dto.glAccountBank,
      userId,
      dto.invoiceIds,
    );
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
    return this.paymentsCoreService.findOne(id);
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
    return this.paymentsWriteService.createPaymentEntry(dto, user.username);
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
    @AuthUser() user: { username: string },
  ) {
    return this.paymentsPostingService.submitPaymentEntry(id, user.username);
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
    return this.paymentsAllocationService.allocatePayment(
      id,
      dto,
      user.username,
    );
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
    @AuthUser() user: { username: string },
  ) {
    return this.paymentsWriteService.cancelPayment(id, user.username);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Draft Payment',
    description: 'Permanently deletes a payment in the DRAFT state.',
  })
  @ApiOkResponse({
    description: 'Payment successfully deleted',
    type: ConfirmRejectResponseDto,
  })
  remove(@Param('id') id: string) {
    return this.paymentsWriteService.removePayment(id);
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
    const fileContent = await this.paymentsPostingService.exportAba(
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
    const fileContent = await this.paymentsPostingService.exportNacha(
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
    return this.paymentsPostingService.confirmExported(
      dto.paymentIds,
      user.username,
    );
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
    return this.paymentsPostingService.rejectExported(
      dto.paymentIds,
      user.username,
    );
  }
}

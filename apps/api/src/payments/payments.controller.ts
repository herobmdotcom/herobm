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
} from './dto';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { AuthUser } from '../auth/auth-user.decorator';

@Controller('payments')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @CasbinAction('read')
  findAll(
    @Query('days') days?: string,
    @Query('allocation') allocation?: string,
  ) {
    return this.paymentsService.findAll(days, allocation);
  }

  @Get(':id')
  @CasbinAction('read')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Post()
  @CasbinAction('write')
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    queryKey: 'payments',
    pkField: 'paymentId',
    idBodyPath: 'paymentId',
  })
  async create(@Body() dto: CreatePaymentDto, @AuthUser() user: any) {
    return this.paymentsService.createPaymentEntry(dto, user.username);
  }

  @Patch(':id/submit')
  @CasbinAction('write')
  async submit(@Param('id') id: string, @AuthUser() user: any) {
    return this.paymentsService.submitPaymentEntry(id, user.username);
  }

  @Patch(':id/allocate')
  @CasbinAction('write')
  async allocate(
    @Param('id') id: string,
    @Body() dto: AllocatePaymentDto,
    @AuthUser() user: any,
  ) {
    return this.paymentsService.allocatePayment(id, dto, user.username);
  }

  @Patch(':id/cancel')
  @CasbinAction('write')
  async cancel(@Param('id') id: string, @AuthUser() user: any) {
    return this.paymentsService.cancelPayment(id, user.username);
  }

  @Post('export-aba')
  @CasbinAction('write')
  async exportAba(@Body() dto: BatchPaymentActionDto, @AuthUser() user: any) {
    const fileContent = await this.paymentsService.exportAba(
      dto.paymentIds,
      user.username,
    );
    return { fileContent }; // Return as json for the frontend to blobify
  }

  @Post('confirm-exported')
  @CasbinAction('write')
  async confirmExported(
    @Body() dto: BatchPaymentActionDto,
    @AuthUser() user: any,
  ) {
    return this.paymentsService.confirmExported(dto.paymentIds, user.username);
  }

  @Post('reject-exported')
  @CasbinAction('write')
  async rejectExported(
    @Body() dto: BatchPaymentActionDto,
    @AuthUser() user: any,
  ) {
    return this.paymentsService.rejectExported(dto.paymentIds, user.username);
  }
}

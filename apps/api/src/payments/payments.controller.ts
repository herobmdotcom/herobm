import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Patch,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, AllocatePaymentDto } from './dto';
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
}

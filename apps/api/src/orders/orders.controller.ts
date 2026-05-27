import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrdersService } from './orders.service';
import { Idempotent } from '../common/idempotency/idempotent.decorator';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { OrdersWriteService } from './orders-write.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import {
  CreateOrderDto,
  UpdateOrderDto,
  CreateOrderLineDto,
  UpdateOrderLineDto,
} from './dto';
import { PaginationQuery } from '../common/pagination';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

/**
 * Core order CRUD and state transition endpoints.
 *
 * Sub-domain endpoints are split into focused controllers:
 * - OrderReturnsController  → /sales-orders/:id/returns/*
 * - OrderPickingController  → /sales-orders/:id/picking/*
 * - OrderShipmentsController → /sales-orders/:id/shipments/*
 * - SalesInvoiceController  → /sales-orders/:id/invoice (in InvoicesModule)
 */
@Controller('sales-orders')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('sales-orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersWriteService: OrdersWriteService,
  ) {}

  // -------------------------------------------------------------------------
  // Read endpoints — unified list (ABM + app via UNION)
  // -------------------------------------------------------------------------

  @Get()
  @CasbinAction('read')
  findAll(@Query() query: PaginationQuery) {
    return this.ordersService.findAll(query);
  }

  @Get(':id')
  @CasbinAction('read')
  findOne(@Param('id') id: string) {
    return this.ordersWriteService.findOne(id);
  }

  // -------------------------------------------------------------------------
  // Write endpoints (modbm_core app data)
  // -------------------------------------------------------------------------

  @Post()
  @CasbinAction('write')
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    queryKey: 'salesOrders',
    pkField: 'salesOrderId',
    idBodyPath: 'salesOrderId',
  })
  create(@Body() body: CreateOrderDto, @AuthUser() user: JwtUser) {
    return this.ordersWriteService.create(body, user.username);
  }

  @Patch(':id')
  @CasbinAction('write')
  update(
    @Param('id') id: string,
    @Body() body: UpdateOrderDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.ordersWriteService.update(id, body, user.username);
  }

  @Patch(':id/state')
  @CasbinAction('write')
  async changeState(
    @Param('id') id: string,
    @Body('stateCode') stateCode: string,
    @AuthUser() user: JwtUser,
    @Body('generateBackorders') generateBackorders?: boolean,
    @Body('discrepanciesAcknowledged') discrepanciesAcknowledged?: boolean,
  ) {
    return this.ordersWriteService.changeSalesOrderState(
      id,
      stateCode,
      user.username,
      generateBackorders,
      discrepanciesAcknowledged,
    );
  }

  @Post(':id/archive')
  @CasbinAction('archive')
  archive(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.ordersWriteService.archive(id, user.username);
  }

  @Post(':id/unarchive')
  @CasbinAction('archive')
  unarchive(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.ordersWriteService.unarchive(id, user.username);
  }

  @Post(':id/lines')
  @CasbinAction('write')
  addLine(
    @Param('id') id: string,
    @Body() body: CreateOrderLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.ordersWriteService.addLine(id, body, user.username);
  }

  @Patch(':id/lines/:lineId')
  @CasbinAction('write')
  updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: UpdateOrderLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.ordersWriteService.updateLine(id, lineId, body, user.username);
  }

  @Delete(':id/lines/:lineId')
  @CasbinAction('write')
  removeLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.ordersWriteService.removeLine(id, lineId, user.username);
  }

  @Post(':id/post-confirmation-lines')
  @CasbinAction('write')
  addPostConfirmationLine(
    @Param('id') id: string,
    @Body() body: CreateOrderLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.ordersWriteService.addPostConfirmationLine(
      id,
      body,
      user.username,
    );
  }
}

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
  OrderResponseDto,
  EmptyBodyDto,
  ChangeOrderStateDto,
} from './dto';
import { PaginationQuery, ApiPaginatedResponse } from '../common/pagination';
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
import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('Orders')
@Controller('sales-orders')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
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
  @ApiOperation({
    summary: 'Find All Orders',
    description: 'Retrieve a paginated list of sales orders globally.',
  })
  @ApiFieldMask()
  @ApiPaginatedResponse(OrderResponseDto)
  findAll(@Query() query: PaginationQuery) {
    return this.ordersService.findAll(query);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find Order',
    description: 'Retrieve detailed information for a specific sales order.',
  })
  @ApiFieldMask()
  @ApiOkResponse({ type: OrderResponseDto })
  findOne(@Param('id') id: string) {
    return this.ordersWriteService.findOne(id);
  }

  // -------------------------------------------------------------------------
  // Write endpoints (modbm_core app data)
  // -------------------------------------------------------------------------

  @Post()
  @ApiBody({ type: CreateOrderDto })
  @CasbinAction('write')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({
    summary: 'Create Order',
    description: 'Create a new sales order with or without line items.',
  })
  @ApiCreatedResponse({ type: OrderResponseDto })
  @Idempotent({
    queryKey: 'salesOrders',
    pkField: 'salesOrderId',
    idBodyPath: 'salesOrderId',
  })
  create(@Body() body: CreateOrderDto, @AuthUser() user: JwtUser) {
    return this.ordersWriteService.create(body, user.username);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateOrderDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Order',
    description: 'Modify the details or metadata of an existing sales order.',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  update(
    @Param('id') id: string,
    @Body() body: UpdateOrderDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.ordersWriteService.update(id, body, user.username);
  }

  @Patch(':id/state')
  @ApiBody({ type: ChangeOrderStateDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Change Order State',
    description: 'Update the processing state of a sales order.',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  async changeState(
    @Param('id') id: string,
    @Body() dto: ChangeOrderStateDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.ordersWriteService.changeSalesOrderState(
      id,
      dto.stateCode,
      user.username,
      dto.generateBackorders,
      dto.discrepanciesAcknowledged,
    );
  }

  @Post(':id/archive')
  @ApiBody({ type: EmptyBodyDto })
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Archive Order',
    description: 'Mark a sales order as archived.',
  })
  @ApiCreatedResponse({ type: OrderResponseDto })
  archive(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.ordersWriteService.archive(id, user.username);
  }

  @Post(':id/unarchive')
  @ApiBody({ type: EmptyBodyDto })
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Unarchive Order',
    description: 'Restore an archived sales order.',
  })
  @ApiCreatedResponse({ type: OrderResponseDto })
  unarchive(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.ordersWriteService.unarchive(id, user.username);
  }

  @Post(':id/lines')
  @ApiBody({ type: CreateOrderLineDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Order Line',
    description: 'Add a new line item to a draft sales order.',
  })
  @ApiCreatedResponse({ type: OrderResponseDto })
  addLine(
    @Param('id') id: string,
    @Body() body: CreateOrderLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.ordersWriteService.addLine(id, body, user.username);
  }

  @Patch(':id/lines/:lineId')
  @ApiBody({ type: UpdateOrderLineDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Order Line',
    description: 'Modify an existing line item on a sales order.',
  })
  @ApiOkResponse({ type: OrderResponseDto })
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
  @ApiOperation({
    summary: 'Remove Order Line',
    description: 'Delete a line item from a sales order.',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  removeLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.ordersWriteService.removeLine(id, lineId, user.username);
  }

  @Post(':id/post-confirmation-lines')
  @ApiBody({ type: CreateOrderLineDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Post-Confirmation Line',
    description: 'Add a new line item to a confirmed sales order.',
  })
  @ApiCreatedResponse({ type: OrderResponseDto })
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

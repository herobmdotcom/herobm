import { SystemResource } from '@herobm/shared';
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
  UseInterceptors,
  HttpCode,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Idempotent } from '../common/idempotency/idempotent.decorator';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { OrderCreationService } from './order-creation.service';
import { OrderLinesService } from './order-lines.service';
import { OrderStateService } from './order-state.service';
import { OrdersCoreService } from './orders-core.service';
import { OrdersQueryService } from './orders-query.service';
import { DocumentDispatchService } from '../notifications/document-dispatch.service';
import { DATA_SOURCE_CONTEXT, SALES_ORDER_STATE } from '@herobm/shared';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import {
  CreateOrderDto,
  UpdateOrderDto,
  CreateOrderLineDto,
  UpdateOrderLineDto,
  OrderResponseDto,
  EmptyBodyDto,
  ChangeOrderStateDto,
  OverrideCreditHoldDto,
  EmailDocumentDto,
  FulfillCounterOrderDto,
  CounterFulfillmentResponseDto,
} from './dto';
import { PaginationQuery, ApiPaginatedResponse } from '../common/pagination';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';
import { CounterFulfillmentService } from './counter-fulfillment.service';

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

@ApiTags('Sales Orders')
@Controller('sales-orders')
@CasbinResource(SystemResource.SALES_ORDERS)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderCreationService: OrderCreationService,
    private readonly orderLinesService: OrderLinesService,
    private readonly orderStateService: OrderStateService,
    private readonly ordersCoreService: OrdersCoreService,
    private readonly documentDispatchService: DocumentDispatchService,
    private readonly ordersQueryService: OrdersQueryService,
    private readonly counterFulfillmentService: CounterFulfillmentService,
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

  // -------------------------------------------------------------------------
  // Write endpoints (herobm_core app data)
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
    return this.orderCreationService.create(body, user.username);
  }

  @Post(':id/tax')
  @ApiBody({ type: EmptyBodyDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Calculate Taxes',
    description: 'Manually trigger an external tax calculation for the order.',
  })
  @ApiCreatedResponse({ type: OrderResponseDto })
  async triggerTaxCalculation(
    @Param('id') id: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.orderStateService.triggerTaxCalculation(id, user.username);
  }

  @Post(':id/email-document')
  @ApiBody({ type: EmailDocumentDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Email Document',
    description:
      'Generates a Document PDF and queues it to be emailed to the customer.',
  })
  @ApiCreatedResponse({
    description: 'Email queued successfully.',
    schema: { type: 'object', properties: { success: { type: 'boolean' } } },
  })
  async emailDocument(
    @Param('id') id: string,
    @Body() dto: EmailDocumentDto,
    @AuthUser() user: JwtUser,
  ) {
    const order = await this.ordersQueryService.findOne(id);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }

    const hookSlug = dto.hookSlug || 'sales-order-quote';

    if (hookSlug === 'sales-order-quote') {
      if (
        order.stateCode !== SALES_ORDER_STATE.DRAFT &&
        order.stateCode !== SALES_ORDER_STATE.QUOTED
      ) {
        throw new HttpException(
          'Can only email quotes for orders in draft or quoted state',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    return this.documentDispatchService.emailDocument(
      {
        targetId: dto.targetId || id,
        hookSlug,
        contextSlug: dto.contextSlug || DATA_SOURCE_CONTEXT.SALES_ORDER,
        entityType: 'sales_order',
        entityId: id,
        emailAddress: dto.emailAddress,
        subject: dto.subject,
        body: dto.body,
        customPdfText: dto.customPdfText,
        fallbackFileName: `Document-${order.orderNumber}.pdf`,
      },
      user,
    );
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
    return this.orderStateService.changeSalesOrderState(
      id,
      dto.stateCode,
      user.username,
      dto.generateBackorders,
      dto.discrepanciesAcknowledged,
    );
  }

  @Post(':id/fulfill-counter')
  @ApiBody({ type: FulfillCounterOrderDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Fulfill Counter Order',
    description:
      'Directly issue inventory from pickable bins at the fulfillment location, post COGS, and mark lines fulfilled over the counter without shipping.',
  })
  @ApiOkResponse({ type: CounterFulfillmentResponseDto })
  async fulfillCounterOrder(
    @Param('id') id: string,
    @Body() body: FulfillCounterOrderDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.counterFulfillmentService.fulfillCounterOrder(
      id,
      body,
      user.username,
    );
  }

  @Post(':id/override-credit-hold')
  @ApiBody({ type: OverrideCreditHoldDto })
  @CasbinResource(SystemResource.CREDIT_CONTROL)
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Override Credit Hold',
    description: 'Temporarily overrides a credit hold for this specific order.',
  })
  @HttpCode(200)
  @ApiOkResponse({ type: OrderResponseDto })
  async overrideCreditHold(
    @Param('id') id: string,
    @Body() dto: OverrideCreditHoldDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.orderStateService.overrideCreditHold(
      id,
      dto.reason,
      user.username,
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
    return this.orderCreationService.archive(id, user.username);
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
    return this.orderCreationService.unarchive(id, user.username);
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
    return this.orderLinesService.addLine(id, body, user.username);
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
    return this.orderLinesService.updateLine(id, lineId, body, user.username);
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
    return this.orderLinesService.removeLine(id, lineId, user.username);
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
    return this.orderLinesService.addPostConfirmationLine(
      id,
      body,
      user.username,
    );
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
    return this.ordersQueryService.findOne(id);
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
    return this.orderCreationService.update(id, body, user.username);
  }
}

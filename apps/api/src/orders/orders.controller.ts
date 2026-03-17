import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrdersService } from './orders.service';
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

/**
 * Core order CRUD and state transition endpoints.
 *
 * Sub-domain endpoints are split into focused controllers:
 * - OrderReturnsController  → /sales-orders/:id/returns/*
 * - OrderPickingController  → /sales-orders/:id/picking/*
 * - OrderShipmentsController → /sales-orders/:id/shipments/*
 */
@Controller('sales-orders')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('orders')
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
  findOne(@Param('id') id: string, @Query('source') source?: string) {
    if (source === 'app') {
      return this.ordersWriteService.findOne(id);
    }
    if (source === 'abm') {
      return this.ordersService.findAbmOrder(id);
    }
    return this.ordersService.findOne(id);
  }

  // -------------------------------------------------------------------------
  // Write endpoints (modbm_core app data)
  // -------------------------------------------------------------------------

  @Post()
  @CasbinAction('write')
  create(@Body() body: CreateOrderDto, @Req() req: any) {
    return this.ordersWriteService.create(body, req.user.username);
  }

  @Patch(':id')
  @CasbinAction('write')
  update(
    @Param('id') id: string,
    @Body() body: UpdateOrderDto,
    @Req() req: any,
  ) {
    return this.ordersWriteService.update(id, body, req.user.username);
  }

  @Patch(':id/state')
  @CasbinAction('write')
  changeState(
    @Param('id') id: string,
    @Body('stateCode') stateCode: string,
    @Req() req: any,
  ) {
    return this.ordersWriteService.changeState(
      id,
      stateCode,
      req.user.username,
    );
  }

  @Post(':id/lines')
  @CasbinAction('write')
  addLine(
    @Param('id') id: string,
    @Body() body: CreateOrderLineDto,
    @Req() req: any,
  ) {
    return this.ordersWriteService.addLine(id, body, req.user.username);
  }

  @Patch(':id/lines/:lineId')
  @CasbinAction('write')
  updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: UpdateOrderLineDto,
    @Req() req: any,
  ) {
    return this.ordersWriteService.updateLine(
      id,
      lineId,
      body,
      req.user.username,
    );
  }

  @Delete(':id/lines/:lineId')
  @CasbinAction('write')
  removeLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Req() req: any,
  ) {
    return this.ordersWriteService.removeLine(id, lineId, req.user.username);
  }
}

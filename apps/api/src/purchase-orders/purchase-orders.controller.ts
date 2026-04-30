import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { AuthGuard } from '@nestjs/passport';
import { PaginationQuery } from '../common/pagination';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  CreatePurchaseOrderLineDto,
  UpdatePurchaseOrderLineDto,
} from './dto';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

@UseGuards(AuthGuard('jwt'), CasbinGuard)
@Controller('purchase-orders')
@CasbinResource('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  @CasbinAction('write')
  async create(
    @Body() createPurchaseOrderDto: CreatePurchaseOrderDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.purchaseOrdersService.create(
      createPurchaseOrderDto,
      user.username,
    );
  }

  @Get()
  @CasbinAction('read')
  async findAll(@Query() query: PaginationQuery) {
    return this.purchaseOrdersService.findAll(query);
  }

  @Get('pending-lines')
  @CasbinAction('read')
  async findPendingLines(
    @Query('productId') productId?: string,
    @Query('vendorId') vendorId?: string,
  ) {
    return this.purchaseOrdersService.findPendingLines(productId, vendorId);
  }

  @Get('returnable-lines')
  @CasbinAction('read')
  async findReturnableLines(@Query('productId') productId: string) {
    return this.purchaseOrdersService.findReturnableLines(productId);
  }

  @Get(':id')
  @CasbinAction('read')
  async findOne(@Param('id') id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Patch(':id')
  @CasbinAction('write')
  async update(
    @Param('id') id: string,
    @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.purchaseOrdersService.update(
      id,
      updatePurchaseOrderDto,
      user.username,
    );
  }

  @Patch(':id/state')
  @CasbinAction('write')
  async changeState(
    @Param('id') id: string,
    @Body('stateCode') stateCode: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.purchaseOrdersService.changeState(id, stateCode, user.username);
  }

  @Post(':id/archive')
  @CasbinAction('archive')
  async archive(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.purchaseOrdersService.archive(id, user.username);
  }

  @Post(':id/unarchive')
  @CasbinAction('archive')
  async unarchive(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.purchaseOrdersService.unarchive(id, user.username);
  }

  @Post(':id/lines')
  @CasbinAction('write')
  async addLine(
    @Param('id') id: string,
    @Body() body: CreatePurchaseOrderLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.purchaseOrdersService.addLine(id, body, user.username);
  }

  @Patch(':id/lines/:lineId')
  @CasbinAction('write')
  async updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: UpdatePurchaseOrderLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.purchaseOrdersService.updateLine(
      id,
      lineId,
      body,
      user.username,
    );
  }

  @Delete(':id/lines/:lineId')
  @CasbinAction('write')
  async removeLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.purchaseOrdersService.removeLine(id, lineId, user.username);
  }
}

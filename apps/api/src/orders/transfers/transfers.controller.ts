import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  Patch,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TransferService } from './transfers.service';
import { PaginationQuery } from '../../common/pagination';
import {
  CreateTransferOrderDto,
  UpdateTransferOrderDto,
  CreateTransferOrderLineDto,
  UpdateTransferOrderLineDto,
} from './dto';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../../auth/casbin.guard';
import { AuthUser } from '../../auth/auth-user.decorator';
import type { JwtUser } from '../../auth/auth-user.decorator';

@Controller('transfers')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('sales-orders')
export class TransfersController {
  constructor(private readonly transferService: TransferService) {}

  @Post('from-demands')
  @CasbinAction('write')
  async createTransferFromDemands(
    @Body() body: { sourceLocationId: string; backorderIds: string[] },
    @AuthUser() user: JwtUser,
  ) {
    return this.transferService.createTransferFromDemands(
      body.sourceLocationId,
      body.backorderIds,
      user.username,
    );
  }

  @Get(':id/events')
  @CasbinAction('read')
  async findEvents(@Param('id') id: string) {
    return this.transferService.findEvents(id);
  }

  @Get(':id/picking')
  @CasbinAction('read')
  async getPickingSummary(@Param('id') id: string) {
    return this.transferService.getPickingSummary(id);
  }

  @Post(':id/picking/lines/:lineId')
  @CasbinAction('write')
  async pickLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: { binId: string; quantity: string },
    @AuthUser() user: JwtUser,
  ) {
    return this.transferService.pickLine(
      id,
      lineId,
      body.binId,
      parseFloat(body.quantity),
      user.username,
    );
  }

  @Delete(':id/picking/picks/:pickId')
  @CasbinAction('write')
  async cancelPick(
    @Param('id') id: string,
    @Param('pickId') pickId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.transferService.cancelPick(id, pickId, user.username);
  }
  @Post(':id/ship')
  @CasbinAction('write')
  async shipTransferOrder(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.transferService.shipTransferOrder(id, user.username);
  }

  @Post(':id/receive')
  @CasbinAction('write')
  async receiveTransferOrder(
    @Param('id') id: string,
    @Body() body: { destinationBinId: string },
    @AuthUser() user: JwtUser,
  ) {
    return this.transferService.receiveTransferOrder(
      id,
      body.destinationBinId,
      user.username,
    );
  }

  @Post(':id/cancel')
  @CasbinAction('write')
  async cancelTransferOrder(
    @Param('id') id: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.transferService.cancelTransferOrder(id, user.username);
  }

  @Get()
  @CasbinAction('read')
  async findAll(@Query() query: PaginationQuery) {
    return this.transferService.findAll(query);
  }

  @Get(':id')
  @CasbinAction('read')
  async findOne(@Param('id') id: string) {
    return this.transferService.findOne(id);
  }

  @Post()
  @CasbinAction('write')
  async create(
    @Body() body: CreateTransferOrderDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.transferService.create(body, user.username);
  }

  @Patch(':id')
  @CasbinAction('write')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateTransferOrderDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.transferService.update(id, body, user.username);
  }

  @Post(':id/lines')
  @CasbinAction('write')
  async addLine(
    @Param('id') id: string,
    @Body() body: CreateTransferOrderLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.transferService.addLine(id, body, user.username);
  }

  @Patch(':id/lines/:lineId')
  @CasbinAction('write')
  async updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: UpdateTransferOrderLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.transferService.updateLine(id, lineId, body, user.username);
  }

  @Delete(':id/lines/:lineId')
  @CasbinAction('write')
  async removeLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.transferService.removeLine(id, lineId, user.username);
  }
}

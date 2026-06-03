import { SystemResource } from '@modbm/shared';
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
import {
  ApiOkResponse,
  ApiCreatedResponse,
  ApiTags,
  ApiOperation,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TransferService } from './transfers.service';
import { ApiPaginatedResponse, PaginationQuery } from '../../common/pagination';
import {
  CreateTransferOrderDto,
  UpdateTransferOrderDto,
  CreateTransferOrderLineDto,
  UpdateTransferOrderLineDto,
  TransferResponseDto,
  TransferEventResponseDto,
  TransferPickingSummaryResponseDto,
  CreateTransferFromDemandsDto,
  PickLineDto,
  ReceiveTransferDto,
  EmptyBodyDto,
} from './dto';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../../auth/casbin.guard';
import { AuthUser } from '../../auth/auth-user.decorator';
import type { JwtUser } from '../../auth/auth-user.decorator';

import { ApiFieldMask } from '../../common/decorators/api-field-mask.decorator';

@ApiTags('Orders')
@Controller('transfers')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.SALES_ORDERS)
export class TransfersController {
  constructor(private readonly transferService: TransferService) {}

  @Post('from-demands')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create From Demands',
    description: 'Create a new transfer order from open backorder demands.',
  })
  @ApiCreatedResponse({ type: TransferResponseDto })
  async createTransferFromDemands(
    @Body() body: CreateTransferFromDemandsDto,
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
  @ApiOperation({
    summary: 'Find Events',
    description: 'Retrieve the event history for a specific transfer order.',
  })
  @ApiOkResponse({ type: [TransferEventResponseDto] })
  async findEvents(@Param('id') id: string) {
    return this.transferService.findEvents(id);
  }

  @Get(':id/picking')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Picking Summary',
    description: 'Retrieve the picking summary for a transfer order.',
  })
  @ApiOkResponse({ type: [TransferPickingSummaryResponseDto] })
  async getPickingSummary(@Param('id') id: string) {
    return this.transferService.getPickingSummary(id);
  }

  @Post(':id/picking/lines/:lineId')
  @CasbinAction('handle')
  @ApiOperation({
    summary: 'Pick Transfer Line',
    description: 'Record a picked quantity for a transfer order line item.',
  })
  @ApiCreatedResponse({ type: TransferResponseDto })
  async pickLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: PickLineDto,
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
  @CasbinAction('handle')
  @ApiOperation({
    summary: 'Cancel Transfer Pick',
    description: 'Cancel and revert a recorded pick for a transfer order.',
  })
  @ApiOkResponse({ type: TransferResponseDto })
  async cancelPick(
    @Param('id') id: string,
    @Param('pickId') pickId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.transferService.cancelPick(id, pickId, user.username);
  }
  @Post(':id/ship')
  @CasbinAction('handle')
  @ApiOperation({
    summary: 'Ship Transfer Order',
    description: 'Mark a transfer order as shipped and dispatch inventory.',
  })
  @ApiCreatedResponse({ type: TransferResponseDto })
  async shipTransferOrder(
    @Param('id') id: string,
    @Body() body: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.transferService.shipTransferOrder(id, user.username);
  }

  @Post(':id/receive')
  @CasbinAction('handle')
  @ApiOperation({
    summary: 'Receive Transfer Order',
    description: 'Process the receipt of a transferred inventory.',
  })
  @ApiCreatedResponse({ type: TransferResponseDto })
  async receiveTransferOrder(
    @Param('id') id: string,
    @Body() body: ReceiveTransferDto,
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
  @ApiOperation({
    summary: 'Cancel Transfer Order',
    description: 'Cancel an open transfer order and revert any picks.',
  })
  @ApiCreatedResponse({ type: TransferResponseDto })
  async cancelTransferOrder(
    @Param('id') id: string,
    @Body() body: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.transferService.cancelTransferOrder(id, user.username);
  }

  @Post(':id/cancel-shipment')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Cancel Transfer Order Shipment',
    description: 'Cancel the active dispatched shipment of a transfer order.',
  })
  @ApiCreatedResponse({ type: TransferResponseDto })
  async cancelTransferOrderShipment(
    @Param('id') id: string,
    @Body() body: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.transferService.cancelActiveShipment(id, user.username);
  }

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find All Transfers',
    description: 'Retrieve a paginated list of transfer orders.',
  })
  @ApiPaginatedResponse(TransferResponseDto)
  @ApiFieldMask()
  async findAll(@Query() query: PaginationQuery) {
    return this.transferService.findAll(query);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find Transfer',
    description: 'Retrieve detailed information for a specific transfer order.',
  })
  @ApiOkResponse({ type: TransferResponseDto })
  @ApiFieldMask()
  async findOne(@Param('id') id: string) {
    return this.transferService.findOne(id);
  }

  @Post()
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Transfer Order',
    description: 'Create a new transfer order.',
  })
  @ApiCreatedResponse({ type: TransferResponseDto })
  async create(
    @Body() body: CreateTransferOrderDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.transferService.create(body, user.username);
  }

  @Patch(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Transfer Order',
    description: 'Modify the details of a draft transfer order.',
  })
  @ApiOkResponse({ type: TransferResponseDto })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateTransferOrderDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.transferService.update(id, body, user.username);
  }

  @Post(':id/lines')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Transfer Line',
    description: 'Add a new line item to a transfer order.',
  })
  @ApiCreatedResponse({ type: TransferResponseDto })
  async addLine(
    @Param('id') id: string,
    @Body() body: CreateTransferOrderLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.transferService.addLine(id, body, user.username);
  }

  @Patch(':id/lines/:lineId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Transfer Line',
    description: 'Modify an existing line item on a transfer order.',
  })
  @ApiOkResponse({ type: TransferResponseDto })
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
  @ApiOperation({
    summary: 'Remove Transfer Line',
    description: 'Delete a line item from a transfer order.',
  })
  @ApiOkResponse({ type: TransferResponseDto })
  async removeLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.transferService.removeLine(id, lineId, user.username);
  }
}

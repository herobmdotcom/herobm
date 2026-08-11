import { SystemResource } from '@herobm/shared';
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiCreatedResponse,
  ApiTags,
  ApiOperation,
  ApiBody,
} from '@nestjs/swagger';
import { TransfersCoreService } from './transfers-core.service';
import { TransfersWriteService } from './transfers-write.service';
import { TransfersStateService } from './transfers-state.service';
import { ShipmentResponseDto } from '../dto';
import { ApiPaginatedResponse } from '../../common/pagination';
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
  TransferPaginationQuery,
  EmptyBodyDto,
} from './dto';
import { CasbinResource, CasbinAction } from '../../auth/casbin.guard';
import { AuthUser } from '../../auth/auth-user.decorator';
import type { JwtUser } from '../../auth/auth-user.decorator';
import { ApiFieldMask } from '../../common/decorators/api-field-mask.decorator';

@ApiTags('Transfer Orders')
@Controller('transfers')
@CasbinResource(SystemResource.SALES_ORDERS)
export class TransfersController {
  constructor(
    private readonly coreService: TransfersCoreService,
    private readonly writeService: TransfersWriteService,
    private readonly stateService: TransfersStateService,
  ) {}

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
    return this.writeService.createTransferFromDemands(
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
    return this.coreService.findEvents(id);
  }

  @Get(':id/picking')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Picking Summary',
    description: 'Retrieve the picking summary for a transfer order.',
  })
  @ApiOkResponse({ type: [TransferPickingSummaryResponseDto] })
  async getPickingSummary(@Param('id') id: string) {
    return this.stateService.getPickingSummary(id);
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
    return this.stateService.pickLine(
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
    return this.stateService.cancelPick(id, pickId, user.username);
  }
  @Post(':id/ship')
  @CasbinAction('handle')
  @ApiOperation({
    summary: 'Ship Transfer Order',
    description: 'Mark a transfer order as shipped and dispatch inventory.',
  })
  @ApiBody({ type: EmptyBodyDto })
  @ApiCreatedResponse({ type: TransferResponseDto })
  async shipTransferOrder(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.stateService.shipTransferOrder(id, user.username);
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
    return this.stateService.receiveTransferOrder(
      id,
      body.lines,
      user.username,
    );
  }

  @Post(':id/cancel')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Cancel Transfer Order',
    description: 'Cancel an open transfer order and revert any picks.',
  })
  @ApiBody({ type: EmptyBodyDto })
  @ApiCreatedResponse({ type: TransferResponseDto })
  async cancelTransferOrder(
    @Param('id') id: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.stateService.cancelTransferOrder(id, user.username);
  }

  @Post(':id/cancel-shipment')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Cancel Transfer Order Shipment',
    description: 'Cancel the active dispatched shipment of a transfer order.',
  })
  @ApiBody({ type: EmptyBodyDto })
  @ApiCreatedResponse({ type: TransferResponseDto })
  async cancelTransferOrderShipment(
    @Param('id') id: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.stateService.cancelActiveShipment(id, user.username);
  }

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find All Transfers',
    description: 'Retrieve a paginated list of transfer orders.',
  })
  @ApiPaginatedResponse(TransferResponseDto)
  @ApiFieldMask()
  async findAll(@Query() query: TransferPaginationQuery) {
    return this.coreService.findAll(query);
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
    return this.coreService.findOne(id);
  }

  @Get(':id/shipments')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find Shipments',
    description: 'Retrieve all shipments for a specific transfer order.',
  })
  @ApiOkResponse({ type: [ShipmentResponseDto] })
  async findShipments(@Param('id') id: string) {
    return this.coreService.findShipments(id);
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
    return this.writeService.create(body, user.username);
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
    return this.writeService.update(id, body, user.username);
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
    return this.writeService.addLine(id, body, user.username);
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
    return this.writeService.updateLine(id, lineId, body, user.username);
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
    return this.writeService.removeLine(id, lineId, user.username);
  }
}

import { SystemResource } from '@herobm/shared';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
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
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { WorkOrdersService } from './work-orders.service';
import {
  WorkOrderResponseDto,
  CreateWorkOrderDto,
  UpdateWorkOrderDto,
  UpdateWorkOrderComponentDto,
  EmptyBodyDto,
  PickWorkOrderComponentDto,
  WorkOrderPickingSummaryDto,
} from './dto';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

@Controller('manufacturing/work-orders')
@CasbinResource(SystemResource.WORK_ORDERS)
@ApiTags('Manufacturing / Work Orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Work Orders',
    description: 'Get all work orders with optional filtering by days.',
  })
  @ApiQuery({ name: 'days', required: false, type: Number })
  @ApiOkResponse({ type: [WorkOrderResponseDto] })
  async findAll(@Query('days') days?: string): Promise<WorkOrderResponseDto[]> {
    const daysNum = days ? parseInt(days, 10) : undefined;
    return await this.workOrdersService.findAll(daysNum);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Work Order by ID',
    description: 'Get work order details including component line items.',
  })
  @ApiOkResponse({ type: WorkOrderResponseDto })
  async findOne(@Param('id') id: string): Promise<WorkOrderResponseDto> {
    return await this.workOrdersService.findOne(id);
  }

  @Post()
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Work Order',
    description: 'Manually create a new Work Order.',
  })
  @ApiBody({ type: CreateWorkOrderDto })
  @ApiCreatedResponse({ type: WorkOrderResponseDto })
  async create(
    @Body() dto: CreateWorkOrderDto,
    @AuthUser() user: JwtUser,
  ): Promise<WorkOrderResponseDto> {
    return await this.workOrdersService.create(dto, user?.username);
  }

  @Patch(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Work Order',
    description: 'Update a draft Work Order.',
  })
  @ApiBody({ type: UpdateWorkOrderDto })
  @ApiOkResponse({ type: WorkOrderResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkOrderDto,
    @AuthUser() user: JwtUser,
  ): Promise<WorkOrderResponseDto> {
    return await this.workOrdersService.update(id, dto, user?.username);
  }

  @Patch(':id/components/:componentId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Work Order Component',
    description: 'Update a component on a draft Work Order.',
  })
  @ApiBody({ type: UpdateWorkOrderComponentDto })
  @ApiOkResponse({ type: WorkOrderResponseDto })
  async updateComponent(
    @Param('id') id: string,
    @Param('componentId') componentId: string,
    @Body() dto: UpdateWorkOrderComponentDto,
    @AuthUser() user: JwtUser,
  ): Promise<WorkOrderResponseDto> {
    return await this.workOrdersService.updateComponent(
      id,
      componentId,
      dto,
      user?.username,
    );
  }

  @Post(':id/release')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Release Work Order',
    description:
      'Transition Work Order from DRAFT to IN_PROGRESS and generate component picks.',
  })
  @ApiBody({ type: EmptyBodyDto })
  @ApiOkResponse({ type: WorkOrderResponseDto })
  async release(
    @Param('id') id: string,
    @AuthUser() user: JwtUser,
  ): Promise<WorkOrderResponseDto> {
    return await this.workOrdersService.release(id, user?.username);
  }

  @Post(':id/complete')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Complete Work Order Production',
    description:
      'Transition Work Order from IN_PROGRESS to COMPLETED and record output stock.',
  })
  @ApiBody({ type: EmptyBodyDto })
  @ApiOkResponse({ type: WorkOrderResponseDto })
  async completeBuild(
    @Param('id') id: string,
    @AuthUser() user: JwtUser,
  ): Promise<WorkOrderResponseDto> {
    return await this.workOrdersService.completeBuild(
      id,
      undefined,
      user?.username,
    );
  }

  @Post(':id/cancel')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Cancel Work Order',
    description: 'Cancel a Work Order and release component picks.',
  })
  @ApiBody({ type: EmptyBodyDto })
  @ApiOkResponse({ type: WorkOrderResponseDto })
  async cancel(
    @Param('id') id: string,
    @AuthUser() user: JwtUser,
  ): Promise<WorkOrderResponseDto> {
    return await this.workOrdersService.cancel(id, user?.username);
  }

  @Get(':id/picking')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Work Order Picking Summary',
    description: 'Retrieve component picking summary for a Work Order.',
  })
  @ApiOkResponse({ type: WorkOrderPickingSummaryDto })
  async getPickingSummary(@Param('id') id: string) {
    return await this.workOrdersService.getPickingSummary(id);
  }

  @Post(':id/picking/lines/:lineId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Pick Work Order Component',
    description: 'Record picked component quantity into WIP bin.',
  })
  @ApiBody({ type: PickWorkOrderComponentDto })
  @ApiCreatedResponse({ type: WorkOrderPickingSummaryDto })
  async pickLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: PickWorkOrderComponentDto,
    @AuthUser() user: JwtUser,
  ) {
    return await this.workOrdersService.pickComponent(
      id,
      lineId,
      dto.binId,
      dto.quantity,
      user?.username,
    );
  }

  @Delete(':id/picking/picks/:pickId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Cancel Component Pick',
    description:
      'Cancel a recorded component pick and reverse stock to storage.',
  })
  @ApiOkResponse({ type: WorkOrderPickingSummaryDto })
  async cancelPick(
    @Param('id') id: string,
    @Param('pickId') pickId: string,
    @AuthUser() user: JwtUser,
  ) {
    return await this.workOrdersService.cancelComponentPick(
      id,
      pickId,
      user?.username,
    );
  }
}

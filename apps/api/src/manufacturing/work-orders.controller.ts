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

  @Post(':id/putaway')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Putaway Finished Goods',
    description:
      'Transfer finished goods to warehouse storage bin and fulfill linked backorders.',
  })
  @ApiBody({ type: EmptyBodyDto })
  @ApiOkResponse({ type: WorkOrderResponseDto })
  async putawayFinishedGoods(
    @Param('id') id: string,
    @AuthUser() user: JwtUser,
  ): Promise<WorkOrderResponseDto> {
    return await this.workOrdersService.putawayFinishedGoods(
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
}

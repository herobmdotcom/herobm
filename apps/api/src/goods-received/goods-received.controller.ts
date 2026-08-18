import { SystemResource } from '@herobm/shared';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseInterceptors,
} from '@nestjs/common';

import { GoodsReceivedCoreService } from './goods-received-core.service';
import { GoodsReceivedWriteService } from './goods-received-write.service';
import { Idempotent } from '../common/idempotency/idempotent.decorator';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { PaginationQuery } from '../common/pagination';
import { ApiPaginatedResponse } from '../common/pagination';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import {
  CreateGoodsReceivedDto,
  UpdateGoodsReceivedDto,
  ResolveAllocationDto,
  GoodsReceivedResponseDto,
  GoodsReceivedLineResponseDto,
  PaginatedGoodsReceivedDto,
  PaginatedGoodsReceivedLineDto,
  CancelReceptionResponseDto,
  EmptyBodyDto,
  ResolveAllocationResponseDto,
} from './dto';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@Controller('goods-received')
@CasbinResource(SystemResource.GOODS_RECEIVED)
@ApiTags('Warehouse')
export class GoodsReceivedController {
  constructor(
    private readonly coreService: GoodsReceivedCoreService,
    private readonly writeService: GoodsReceivedWriteService,
  ) {}

  @Post()
  @ApiBody({ type: CreateGoodsReceivedDto })
  @CasbinAction('handle')
  @ApiOperation({
    summary: 'Create Goods Receipt',
    description: 'Create a new goods receipt note.',
  })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    queryKey: 'goodsReceived',
    pkField: 'goodsReceivedId',
    idBodyPath: 'goodsReceivedId',
  })
  @ApiCreatedResponse({ type: GoodsReceivedResponseDto })
  async create(
    @Body() createDto: CreateGoodsReceivedDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.writeService.create(createDto, user.username);
  }

  @Get()
  @ApiOkResponse({ type: PaginatedGoodsReceivedDto })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Goods Receipts',
    description: 'Retrieve a paginated list of goods receipts.',
  })
  @ApiPaginatedResponse(GoodsReceivedResponseDto)
  @ApiFieldMask()
  async findAll(@Query() query: PaginationQuery) {
    return this.coreService.findAll(query);
  }

  @Get('lines')
  @ApiOkResponse({ type: PaginatedGoodsReceivedLineDto })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Received Lines',
    description: 'Retrieve a paginated list of received goods lines.',
  })
  @ApiPaginatedResponse(GoodsReceivedLineResponseDto)
  @ApiQuery({ name: 'purchaseOrderId', required: false })
  @ApiQuery({ name: 'putawayStatus', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  async findAllLines(
    @Query() query: PaginationQuery,
    @Query('purchaseOrderId') purchaseOrderId?: string,
    @Query('putawayStatus') putawayStatus?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.coreService.findAllLines(
      query,
      purchaseOrderId,
      putawayStatus,
      locationId,
    );
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Goods Receipt',
    description: 'Retrieve details for a specific goods receipt note.',
  })
  @ApiOkResponse({ type: GoodsReceivedResponseDto })
  @ApiFieldMask()
  async findOne(@Param('id') id: string) {
    return this.coreService.findOne(id);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateGoodsReceivedDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Goods Receipt',
    description: 'Update header fields for an existing goods receipt note.',
  })
  @ApiOkResponse({ type: GoodsReceivedResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateGoodsReceivedDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.writeService.update(id, updateDto, user.username);
  }

  @Post(':id/cancel')
  @ApiBody({ type: EmptyBodyDto })
  @ApiCreatedResponse({ type: CancelReceptionResponseDto })
  @CasbinAction('handle')
  @ApiOperation({
    summary: 'Cancel Goods Receipt',
    description: 'Cancel an existing goods receipt note.',
  })
  @ApiOkResponse({
    schema: { type: 'object', properties: { success: { type: 'boolean' } } },
  })
  async cancelReception(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.writeService.cancelReception(id, user.username);
  }

  @Post('lines/:lineId/resolve')
  @ApiBody({ type: ResolveAllocationDto })
  @ApiCreatedResponse({ type: ResolveAllocationResponseDto })
  @CasbinAction('handle')
  @ApiOperation({
    summary: 'Resolve Allocation',
    description: 'Resolve allocation for a received goods line.',
  })
  @ApiOkResponse({ type: ResolveAllocationResponseDto })
  async resolveAllocation(
    @Param('lineId') lineId: string,
    @Body() resolveDto: ResolveAllocationDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.writeService.resolveAllocation(
      lineId,
      resolveDto.purchaseOrderLineId,
      user.username,
      resolveDto.allocatedQuantity,
    );
  }

  @Post('lines/:lineId/unresolve')
  @ApiBody({ type: EmptyBodyDto })
  @ApiCreatedResponse({ type: GoodsReceivedLineResponseDto })
  @CasbinAction('handle')
  @ApiOperation({
    summary: 'Unresolve Allocation',
    description: 'Unresolve allocation for a received goods line.',
  })
  @ApiOkResponse({ type: GoodsReceivedLineResponseDto })
  async unresolveAllocation(
    @Param('lineId') lineId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.writeService.unresolveAllocation(lineId, user.username);
  }
}

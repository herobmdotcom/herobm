import { SystemResource } from '@modbm/shared';
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
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
} from '@nestjs/common';

import { GoodsReceivedService } from './goods-received.service';
import { Idempotent } from '../common/idempotency/idempotent.decorator';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { AuthGuard } from '@nestjs/passport';
import { PaginationQuery } from '../common/pagination';
import { ApiPaginatedResponse } from '../common/pagination';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import {
  CreateGoodsReceivedDto,
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

@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@Controller('goods-received')
@CasbinResource(SystemResource.GOODS_RECEIVED)
@ApiTags('GoodsReceived')
export class GoodsReceivedController {
  constructor(private readonly goodsReceivedService: GoodsReceivedService) {}

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
    return this.goodsReceivedService.create(createDto, user.username);
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
    return this.goodsReceivedService.findAll(query);
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
    return this.goodsReceivedService.findAllLines(
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
    return this.goodsReceivedService.findOne(id);
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
  async cancelReception(
    @Param('id') id: string,
    @Body() body: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.goodsReceivedService.cancelReception(id, user.username);
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
    return this.goodsReceivedService.resolveAllocation(
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
    @Body() body: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.goodsReceivedService.unresolveAllocation(lineId, user.username);
  }
}

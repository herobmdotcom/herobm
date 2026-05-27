import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { GoodsReceivedService } from './goods-received.service';
import { Idempotent } from '../common/idempotency/idempotent.decorator';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { AuthGuard } from '@nestjs/passport';
import { PaginationQuery } from '../common/pagination';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { CreateGoodsReceivedDto, ResolveAllocationDto } from './dto';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

@UseGuards(AuthGuard('jwt'), CasbinGuard)
@Controller('goods-received')
@CasbinResource('goods-received')
export class GoodsReceivedController {
  constructor(private readonly goodsReceivedService: GoodsReceivedService) {}

  @Post()
  @CasbinAction('write')
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    queryKey: 'goodsReceived',
    pkField: 'goodsReceivedId',
    idBodyPath: 'goodsReceivedId',
  })
  async create(
    @Body() createDto: CreateGoodsReceivedDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.goodsReceivedService.create(createDto, user.username);
  }

  @Get()
  @CasbinAction('read')
  async findAll(@Query() query: PaginationQuery) {
    return this.goodsReceivedService.findAll(query);
  }

  @Get('lines')
  @CasbinAction('read')
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
  async findOne(@Param('id') id: string) {
    return this.goodsReceivedService.findOne(id);
  }

  @Post(':id/cancel')
  @CasbinAction('write')
  async cancelReception(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.goodsReceivedService.cancelReception(id, user.username);
  }

  @Post('lines/:lineId/resolve')
  @CasbinAction('write')
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
  @CasbinAction('write')
  async unresolveAllocation(
    @Param('lineId') lineId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.goodsReceivedService.unresolveAllocation(lineId, user.username);
  }
}

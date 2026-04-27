import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GoodsReceivedService } from './goods-received.service';
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
  async findAllLines(@Query() query: PaginationQuery) {
    return this.goodsReceivedService.findAllLines(query);
  }

  @Get(':id')
  @CasbinAction('read')
  async findOne(@Param('id') id: string) {
    return this.goodsReceivedService.findOne(id);
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
    );
  }

  @Post('lines/:lineId/unresolve')
  @CasbinAction('write')
  async unresolveAllocation(
    @Param('lineId') lineId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.goodsReceivedService.unresolveAllocation(
      lineId,
      user.username,
    );
  }
}

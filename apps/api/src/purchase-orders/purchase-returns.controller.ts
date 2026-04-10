import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PurchaseReturnsService } from './purchase-returns.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { CreatePurchaseReturnDto } from './dto';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

@Controller('purchase-orders/:id/returns')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('purchase-orders')
export class PurchaseReturnsController {
  constructor(
    private readonly purchaseReturnsService: PurchaseReturnsService,
  ) {}

  @Post()
  @CasbinAction('write')
  createReturn(
    @Param('id') id: string,
    @Body() body: CreatePurchaseReturnDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.purchaseReturnsService.createReturn(id, body, user.username);
  }

  @Get()
  @CasbinAction('read')
  findReturns(@Param('id') id: string) {
    return this.purchaseReturnsService.findByOrder(id);
  }

  @Get(':returnId')
  @CasbinAction('read')
  findReturn(@Param('id') _id: string, @Param('returnId') returnId: string) {
    return this.purchaseReturnsService.findOne(returnId);
  }

  @Post(':returnId/action')
  @CasbinAction('write')
  actionReturn(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.purchaseReturnsService.actionReturn(returnId, user.username);
  }
}

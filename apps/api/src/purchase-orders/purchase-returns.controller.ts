import {
  ApiTags,
  ApiOperation,
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
  Param,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PurchaseReturnsService } from './purchase-returns.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import {
  CreatePurchaseReturnDto,
  PurchaseReturnResponseDto,
  EmptyBodyDto,
} from './dto';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

@Controller('purchase-orders/:id/returns')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource('purchase-orders')
@ApiTags('PurchaseReturns')
export class PurchaseReturnsController {
  constructor(
    private readonly purchaseReturnsService: PurchaseReturnsService,
  ) {}

  @Post()
  @ApiBody({ type: CreatePurchaseReturnDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Purchase Return',
    description: 'Create a return for a specific purchase order.',
  })
  @ApiCreatedResponse({ type: PurchaseReturnResponseDto })
  createReturn(
    @Param('id') id: string,
    @Body() body: CreatePurchaseReturnDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.purchaseReturnsService.createReturn(id, body, user.username);
  }

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Purchase Returns',
    description: 'Retrieve all returns for a specific purchase order.',
  })
  @ApiOkResponse({ type: PurchaseReturnResponseDto, isArray: true })
  findReturns(@Param('id') id: string) {
    return this.purchaseReturnsService.findByOrder(id);
  }

  @Get(':returnId')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Purchase Return',
    description: 'Retrieve details for a specific return on an order.',
  })
  @ApiOkResponse({ type: PurchaseReturnResponseDto })
  findReturn(@Param('id') _id: string, @Param('returnId') returnId: string) {
    return this.purchaseReturnsService.findOne(returnId);
  }

  @Post(':returnId/stage')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Stage Purchase Return',
    description: 'Mark a purchase return as staged for shipping.',
  })
  @ApiOkResponse({ type: PurchaseReturnResponseDto })
  @ApiBody({ type: EmptyBodyDto })
  @HttpCode(200)
  stageReturn(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Body() body: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.purchaseReturnsService.stageReturn(returnId, user.username);
  }

  @Post(':returnId/ship')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Ship Purchase Return',
    description: 'Mark a staged purchase return as shipped.',
  })
  @ApiOkResponse({ type: PurchaseReturnResponseDto })
  @ApiBody({ type: EmptyBodyDto })
  @HttpCode(200)
  shipReturn(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Body() body: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.purchaseReturnsService.shipReturn(returnId, user.username);
  }
}

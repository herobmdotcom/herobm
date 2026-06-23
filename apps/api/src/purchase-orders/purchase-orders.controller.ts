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
  Body,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
} from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { AuthGuard } from '@nestjs/passport';
import { Idempotent } from '../common/idempotency/idempotent.decorator';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { PaginationQuery, ApiPaginatedResponse } from '../common/pagination';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  CreatePurchaseOrderLineDto,
  UpdatePurchaseOrderLineDto,
  PurchaseOrderResponseDto,
  PurchaseOrderLineResponseDto,
  EmptyBodyDto,
  ChangeStateDto,
} from './dto';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@Controller('purchase-orders')
@CasbinResource(SystemResource.PURCHASE_ORDERS)
@ApiTags('Purchase Orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  @ApiBody({ type: CreatePurchaseOrderDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Purchase Order',
    description: 'Create a new purchase order.',
  })
  @UseInterceptors(IdempotencyInterceptor)
  @ApiCreatedResponse({ type: PurchaseOrderResponseDto })
  @Idempotent({
    queryKey: 'purchaseOrders',
    pkField: 'purchaseOrderId',
    idBodyPath: 'purchaseOrderId',
  })
  async create(
    @Body() createPurchaseOrderDto: CreatePurchaseOrderDto,
    @AuthUser() user: JwtUser,
  ) {
    console.log('[DEBUG] Controller - received create PO request');
    return this.purchaseOrdersService.create(
      createPurchaseOrderDto,
      user.username,
    );
  }

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Purchase Orders',
    description: 'Retrieve a paginated list of purchase orders.',
  })
  @ApiFieldMask()
  @ApiPaginatedResponse(PurchaseOrderResponseDto)
  async findAll(@Query() query: PaginationQuery) {
    return this.purchaseOrdersService.findAll(query);
  }

  @Get('pending-lines')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Pending Lines',
    description: 'Find purchase order lines pending receipt.',
  })
  @ApiOkResponse({ type: [PurchaseOrderLineResponseDto] })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'vendorId', required: false })
  async findPendingLines(
    @Query('productId') productId?: string,
    @Query('vendorId') vendorId?: string,
  ) {
    return this.purchaseOrdersService.findPendingLines(productId, vendorId);
  }

  @Get('returnable-lines')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Returnable Lines',
    description: 'Find purchase order lines eligible for return.',
  })
  @ApiOkResponse({ type: [PurchaseOrderLineResponseDto] })
  async findReturnableLines(@Query('productId') productId: string) {
    return this.purchaseOrdersService.findReturnableLines(productId);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Purchase Order',
    description: 'Retrieve a specific purchase order.',
  })
  @ApiFieldMask()
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  async findOne(@Param('id') id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Patch(':id')
  @ApiBody({ type: UpdatePurchaseOrderDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Purchase Order',
    description: 'Update an existing purchase order.',
  })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.purchaseOrdersService.update(
      id,
      updatePurchaseOrderDto,
      user.username,
    );
  }

  @Patch(':id/state')
  @ApiBody({ type: ChangeStateDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Change Order State',
    description: 'Update the state of a purchase order.',
  })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  async changeState(
    @Param('id') id: string,
    @Body() body: ChangeStateDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.purchaseOrdersService.changePurchaseOrderState(
      id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      body.stateCode as any,
      user.username,
    );
  }

  @Post(':id/archive')
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Archive Purchase Order',
    description: 'Archive a purchase order.',
  })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  @ApiBody({ type: EmptyBodyDto })
  @HttpCode(200)
  async archive(
    @Param('id') id: string,
    @Body() body: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.purchaseOrdersService.archive(id, user.username);
  }

  @Post(':id/unarchive')
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Unarchive Purchase Order',
    description: 'Restore an archived purchase order.',
  })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  @ApiBody({ type: EmptyBodyDto })
  @HttpCode(200)
  async unarchive(
    @Param('id') id: string,
    @Body() body: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.purchaseOrdersService.unarchive(id, user.username);
  }

  @Post(':id/lines')
  @ApiBody({ type: CreatePurchaseOrderLineDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Order Line',
    description: 'Add a new line item to a purchase order.',
  })
  @ApiCreatedResponse({ type: PurchaseOrderResponseDto })
  async addLine(
    @Param('id') id: string,
    @Body() body: CreatePurchaseOrderLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.purchaseOrdersService.addLine(id, body, user.username);
  }

  @Patch(':id/lines/:lineId')
  @ApiBody({ type: UpdatePurchaseOrderLineDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Order Line',
    description: 'Modify a specific line item on a purchase order.',
  })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  async updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: UpdatePurchaseOrderLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.purchaseOrdersService.updateLine(
      id,
      lineId,
      body,
      user.username,
    );
  }

  @Delete(':id/lines/:lineId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Order Line',
    description: 'Delete a line item from a purchase order.',
  })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  async removeLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.purchaseOrdersService.removeLine(id, lineId, user.username);
  }
}

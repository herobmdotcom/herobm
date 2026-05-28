import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
  Query,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { SalesInvoiceService } from './sales-invoice.service';
import { PurchaseInvoiceService } from './purchase-invoice.service';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import {
  CreateSalesInvoiceDto,
  CreateStandaloneInvoiceDto,
  ChangeInvoiceStateDto,
  UpdateInvoiceLineDto,
  ResolveInvoiceLineDto,
  AutoMatchPurchaseOrderDto,
  PurchaseInvoiceResponseDto,
  SalesInvoiceResponseDto,
  PurchaseInvoiceListResponseDto,
  SalesInvoiceListResponseDto,
} from './dto';

export class EmptyBodyDto {}

/**
 * Sales-order–scoped invoice endpoints (AR).
 * Uses the same 'sales-orders' prefix so routes nest under that path.
 */
@Controller('sales-orders')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource('sales-orders')
@ApiTags('Invoices')
export class SalesInvoiceController {
  constructor(private readonly salesInvoiceService: SalesInvoiceService) {}

  @Post(':id/invoice')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Sales Invoice',
    description: 'Create an invoice for a sales order',
  })
  @ApiCreatedResponse({ type: SalesInvoiceResponseDto })
  async createSalesInvoice(
    @Param('id') id: string,
    @Body() dto: CreateSalesInvoiceDto,
    @Request() req: any,
  ) {
    const actor = req.user?.username || 'system';
    return this.salesInvoiceService.createInvoice(id, dto, actor);
  }

  @Get(':id/invoices')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Sales Invoices',
    description: 'Retrieve invoices for a sales order',
  })
  @ApiOkResponse({ type: SalesInvoiceResponseDto })
  async getSalesInvoices(@Param('id') id: string) {
    return { data: await this.salesInvoiceService.findByOrder(id) };
  }
}

/**
 * Purchase-order–scoped invoice endpoints (AP).
 * Uses the same 'purchase-orders' prefix so routes nest under that path.
 */
@Controller('purchase-orders')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource('purchase-orders')
@ApiTags('Invoices')
export class PurchaseInvoiceController {
  constructor(
    private readonly purchaseInvoiceService: PurchaseInvoiceService,
  ) {}

  @Get(':id/invoices')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Purchase Bills',
    description: 'Retrieve purchase bills for a purchase order',
  })
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async getPurchaseBills(@Param('id') id: string) {
    return { data: await this.purchaseInvoiceService.findByOrder(id) };
  }
}

/**
 * Standalone invoice detail endpoints (not scoped to an order).
 */
@Controller()
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@ApiTags('Invoices')
export class InvoiceDetailController {
  constructor(
    private readonly salesInvoiceService: SalesInvoiceService,
    private readonly purchaseInvoiceService: PurchaseInvoiceService,
  ) {}

  @Get('sales-invoices/:id')
  @CasbinResource('sales-orders')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Sales Invoice Details',
    description: 'Retrieve details for a specific sales invoice',
  })
  @ApiOkResponse({ type: SalesInvoiceResponseDto })
  async getSalesInvoiceDetails(@Param('id') id: string) {
    return this.salesInvoiceService.findOne(id);
  }

  @Get('sales-invoices')
  @CasbinResource('sales-orders')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get All Sales Invoices',
    description: 'Retrieve all sales invoices across orders',
  })
  @ApiOkResponse({ type: SalesInvoiceListResponseDto })
  async getSalesInvoicesGlobal(
    @Query('days') days?: string,
    @Query('customerId') customerId?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('balanceStatus') balanceStatus?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.salesInvoiceService.findActiveInvoices({
      days: days ? parseInt(days, 10) : undefined,
      customerId,
      invoiceId,
      balanceStatus,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data };
  }

  @Get('purchase-invoices')
  @CasbinResource('purchase-orders')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get All Purchase Invoices',
    description: 'Retrieve all purchase invoices across orders',
  })
  @ApiOkResponse({ type: PurchaseInvoiceListResponseDto })
  async getPurchaseInvoicesGlobal(
    @Query('days') days?: string,
    @Query('vendorId') vendorId?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('balanceStatus') balanceStatus?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.purchaseInvoiceService.findActiveInvoices({
      days: days ? parseInt(days, 10) : undefined,
      vendorId,
      invoiceId,
      balanceStatus,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data };
  }

  @Get('purchase-invoices/:id')
  @CasbinResource('purchase-orders')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Purchase Invoice Details',
    description: 'Retrieve details for a specific purchase invoice',
  })
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async getPurchaseBillDetails(@Param('id') id: string) {
    return this.purchaseInvoiceService.findOne(id);
  }

  @Post('purchase-invoices')
  @CasbinResource('purchase-orders')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Draft Invoice',
    description: 'Create a standalone draft purchase invoice',
  })
  @ApiCreatedResponse({ type: PurchaseInvoiceResponseDto })
  async createDraftInvoice(
    @Body() dto: CreateStandaloneInvoiceDto,
    @Request() req: any,
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceService.createDraftInvoice(dto, actor);
  }

  @Post('purchase-invoices/:id/post')
  @CasbinResource('purchase-orders')
  @CasbinAction('write')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Post Invoice',
    description: 'Post a purchase invoice',
  })
  @ApiBody({ type: EmptyBodyDto })
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async postInvoice(@Param('id') id: string, @Request() req: any) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceService.postInvoice(id, actor);
  }

  @Patch('purchase-invoices/:id/state')
  @CasbinResource('purchase-orders')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Change Invoice State',
    description: 'Change the state of a purchase invoice',
  })
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async changeInvoiceState(
    @Param('id') id: string,
    @Body() dto: ChangeInvoiceStateDto,
    @Request() req: any,
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceService.changePurchaseInvoiceState(
      id,
      dto.stateCode,
      actor,
      dto.discrepanciesAcknowledged,
    );
  }

  @Patch('purchase-invoices/:id')
  @CasbinResource('purchase-orders')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Invoice',
    description: 'Update a purchase invoice',
  })
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async updateInvoice(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceLineDto,
    @Request() req: any,
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceService.updateInvoice(id, dto, actor);
  }

  @Patch('purchase-invoices/:id/lines/:lineId')
  @CasbinResource('purchase-orders')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Invoice Line',
    description: 'Update a specific line item on a purchase invoice',
  })
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async updateInvoiceLine(
    @Param('id') invoiceId: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateInvoiceLineDto,
    @Request() req: any,
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceService.updateLine(
      invoiceId,
      lineId,
      dto,
      actor,
    );
  }

  @Delete('purchase-invoices/:id/lines/:lineId')
  @CasbinResource('purchase-orders')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Invoice Line',
    description: 'Remove a line item from a purchase invoice',
  })
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async removeInvoiceLine(
    @Param('id') invoiceId: string,
    @Param('lineId') lineId: string,
    @Request() req: any,
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceService.removeLine(invoiceId, lineId, actor);
  }

  @Post('purchase-invoices/:id/lines')
  @CasbinResource('purchase-orders')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Invoice Line',
    description: 'Add a new line item to a purchase invoice',
  })
  @ApiCreatedResponse({ type: PurchaseInvoiceResponseDto })
  async addInvoiceLine(
    @Param('id') invoiceId: string,
    @Body() dto: UpdateInvoiceLineDto,
    @Request() req: any,
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceService.addLine(invoiceId, dto, actor);
  }

  @Post('purchase-invoices/lines/:lineId/resolve')
  @CasbinResource('purchase-orders')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Resolve Invoice Line',
    description: 'Resolve a discrepancy on an invoice line',
  })
  @HttpCode(200)
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async resolveInvoiceLine(
    @Param('lineId') lineId: string,
    @Body() dto: ResolveInvoiceLineDto,
    @Request() req: any,
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceService.resolveInvoiceLine(
      lineId,
      dto.purchaseOrderLineId,
      actor,
    );
  }

  @Post('purchase-invoices/lines/:lineId/unresolve')
  @CasbinResource('purchase-orders')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Unresolve Invoice Line',
    description: 'Undo resolution of an invoice line discrepancy',
  })
  @ApiBody({ type: EmptyBodyDto })
  @HttpCode(200)
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async unresolveInvoiceLine(
    @Param('lineId') lineId: string,
    @Request() req: any,
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceService.unresolveInvoiceLine(lineId, actor);
  }

  @Post('purchase-invoices/:id/auto-match')
  @CasbinResource('purchase-orders')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Auto-Match Purchase Order',
    description: 'Automatically match a purchase order',
  })
  @HttpCode(200)
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async autoMatchPurchaseOrder(
    @Param('id') invoiceId: string,
    @Body() dto: AutoMatchPurchaseOrderDto,
    @Request() req: any,
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceService.autoMatchPurchaseOrder(
      invoiceId,
      dto.purchaseOrderId,
      actor,
    );
  }
}

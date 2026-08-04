import { SystemResource } from '@herobm/shared';
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Request,
  Query,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { SalesInvoiceService } from './sales-invoice.service';
import { PurchaseInvoiceCoreService } from './purchase-invoice-core.service';
import { PurchaseInvoiceDraftService } from './purchase-invoice-draft.service';
import { PurchaseInvoicePostingService } from './purchase-invoice-posting.service';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import {
  CreateSalesInvoiceDto,
  CreateStandaloneInvoiceDto,
  ChangeInvoiceStateDto,
  UpdateInvoiceLineDto,
  UpdatePurchaseInvoiceDto,
  ResolveInvoiceLineDto,
  AutoMatchPurchaseOrderDto,
  PurchaseInvoiceResponseDto,
  SalesInvoiceResponseDto,
} from './dto';
import {
  PaginationQuery,
  ApiPaginatedResponse,
  parsePagination,
} from '../common/pagination';

export class EmptyBodyDto {}

/**
 * Sales-order–scoped invoice endpoints (AR).
 * Uses the same 'sales-orders' prefix so routes nest under that path.
 */
@Controller('sales-orders')
@CasbinResource(SystemResource.SALES_ORDERS)
@ApiTags('Sales Invoices')
export class SalesInvoiceController {
  constructor(private readonly salesInvoiceService: SalesInvoiceService) {}

  @Post(':id/invoice')
  @CasbinAction('invoice')
  @ApiOperation({
    summary: 'Create Sales Invoice',
    description: 'Create an invoice for a sales order',
  })
  @ApiCreatedResponse({ type: SalesInvoiceResponseDto })
  async createSalesInvoice(
    @Param('id') id: string,
    @Body() dto: CreateSalesInvoiceDto,
    @Request() req: { user?: { username?: string } },
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
  @ApiOkResponse({ type: [SalesInvoiceResponseDto] })
  async getSalesInvoices(@Param('id') id: string) {
    return await this.salesInvoiceService.findByOrder(id);
  }
}

/**
 * Purchase-order–scoped invoice endpoints (AP).
 * Uses the same 'purchase-orders' prefix so routes nest under that path.
 */
@Controller('purchase-orders')
@CasbinResource(SystemResource.PURCHASE_ORDERS)
@ApiTags('Purchase Invoices')
export class PurchaseInvoiceController {
  constructor(
    private readonly purchaseInvoiceCoreService: PurchaseInvoiceCoreService,
  ) {}

  @Get(':id/invoices')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Purchase Bills',
    description: 'Retrieve purchase bills for a purchase order',
  })
  @ApiOkResponse({ type: [PurchaseInvoiceResponseDto] })
  async getPurchaseBills(@Param('id') id: string) {
    return await this.purchaseInvoiceCoreService.findByOrder(id);
  }
}

/**
 * Standalone invoice detail endpoints (not scoped to an order).
 */
@Controller()
@ApiTags('Sales Invoices')
export class InvoiceDetailController {
  constructor(
    private readonly salesInvoiceService: SalesInvoiceService,
    private readonly purchaseInvoiceCoreService: PurchaseInvoiceCoreService,
    private readonly purchaseInvoiceDraftService: PurchaseInvoiceDraftService,
    private readonly purchaseInvoicePostingService: PurchaseInvoicePostingService,
  ) {}

  @ApiTags('Sales Invoices')
  @Get('sales-invoices/:id')
  @CasbinResource(SystemResource.SALES_ORDERS)
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Sales Invoice Details',
    description: 'Retrieve details for a specific sales invoice',
  })
  @ApiOkResponse({ type: SalesInvoiceResponseDto })
  async getSalesInvoiceDetails(@Param('id') id: string) {
    return this.salesInvoiceService.findOne(id);
  }

  @ApiTags('Sales Invoices')
  @Patch('sales-invoices/:id/state')
  @CasbinResource(SystemResource.SALES_ORDERS)
  @CasbinAction('invoice')
  @ApiOperation({
    summary: 'Change Sales Invoice State',
    description: 'Change the state of a sales invoice (e.g. to cancel it)',
  })
  @ApiOkResponse({ type: SalesInvoiceResponseDto })
  async changeSalesInvoiceState(
    @Param('id') id: string,
    @Body() dto: ChangeInvoiceStateDto,
    @Request() req: { user?: { username?: string } },
  ) {
    const actor = req.user?.username || 'system';
    return this.salesInvoiceService.changeSalesInvoiceState(
      id,
      dto.stateCode,
      actor,
    );
  }

  @ApiTags('Sales Invoices')
  @Post('sales-invoices/:id/admin-mark-paid')
  @CasbinResource(SystemResource.GL)
  @CasbinAction('write')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mark Sales Invoice as Paid (Admin)',
    description: 'Marks a sales invoice as paid without generating a GL entry.',
  })
  @ApiBody({ type: EmptyBodyDto })
  @ApiOkResponse({ type: SalesInvoiceResponseDto })
  async adminMarkSalesInvoicePaid(
    @Param('id') id: string,
    @Request() req: { user?: { username?: string } },
  ) {
    const actor = req.user?.username || 'system';
    return this.salesInvoiceService.adminMarkPaid(id, actor);
  }

  @ApiTags('Sales Invoices')
  @Get('sales-invoices')
  @CasbinResource(SystemResource.SALES_ORDERS)
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get All Sales Invoices',
    description: 'Retrieve all sales invoices across orders',
  })
  @ApiPaginatedResponse(SalesInvoiceResponseDto)
  @ApiQuery({ name: 'days', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'invoiceId', required: false })
  @ApiQuery({ name: 'balanceStatus', required: false })
  async getSalesInvoicesGlobal(
    @Query() query: PaginationQuery,
    @Query('days') days?: string,
    @Query('customerId') customerId?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('balanceStatus') balanceStatus?: string,
  ) {
    const { limit, cursor, direction, searchTerm } = parsePagination(query);
    const data = await this.salesInvoiceService.findActiveInvoices({
      days: days !== undefined ? parseInt(String(days), 10) : undefined,
      customerId,
      invoiceId,
      balanceStatus,
      limit,
      cursor,
      direction,
      searchTerm,
    });
    return data;
  }

  @ApiTags('Purchase Invoices')
  @Get('purchase-invoices')
  @CasbinResource(SystemResource.PURCHASE_ORDERS)
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get All Purchase Invoices',
    description: 'Retrieve all purchase invoices across orders',
  })
  @ApiPaginatedResponse(PurchaseInvoiceResponseDto)
  @ApiQuery({ name: 'days', required: false })
  @ApiQuery({ name: 'vendorId', required: false })
  @ApiQuery({ name: 'invoiceId', required: false })
  @ApiQuery({ name: 'balanceStatus', required: false })
  async getPurchaseInvoicesGlobal(
    @Query() query: PaginationQuery,
    @Query('days') days?: string,
    @Query('vendorId') vendorId?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('balanceStatus') balanceStatus?: string,
  ) {
    const { limit, cursor, direction, searchTerm } = parsePagination(query);
    const data = await this.purchaseInvoiceCoreService.findActiveInvoices({
      days: days !== undefined ? parseInt(String(days), 10) : undefined,
      vendorId,
      invoiceId,
      balanceStatus,
      limit,
      cursor,
      direction,
      searchTerm,
    });
    return data;
  }

  @ApiTags('Purchase Invoices')
  @Get('purchase-invoices/:id')
  @CasbinResource(SystemResource.PURCHASE_ORDERS)
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Purchase Invoice Details',
    description: 'Retrieve details for a specific purchase invoice',
  })
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async getPurchaseBillDetails(@Param('id') id: string) {
    return this.purchaseInvoiceCoreService.findOne(id);
  }

  @ApiTags('Purchase Invoices')
  @Post('purchase-invoices/:id/admin-mark-paid')
  @CasbinResource(SystemResource.GL)
  @CasbinAction('write')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mark Purchase Invoice as Paid (Admin)',
    description:
      'Marks a purchase invoice as paid without generating a GL entry.',
  })
  @ApiBody({ type: EmptyBodyDto })
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async adminMarkPurchaseInvoicePaid(
    @Param('id') id: string,
    @Request() req: { user?: { username?: string } },
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceDraftService.adminMarkPaid(id, actor);
  }

  @ApiTags('Purchase Invoices')
  @Post('purchase-invoices')
  @CasbinResource(SystemResource.PURCHASE_ORDERS)
  @CasbinAction('invoice')
  @ApiOperation({
    summary: 'Create Draft Invoice',
    description: 'Create a standalone draft purchase invoice',
  })
  @ApiCreatedResponse({ type: PurchaseInvoiceResponseDto })
  async createDraftInvoice(
    @Body() dto: CreateStandaloneInvoiceDto,
    @Request() req: { user?: { username?: string } },
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceDraftService.createDraftInvoice(dto, actor);
  }

  @ApiTags('Purchase Invoices')
  @Post('purchase-invoices/:id/post')
  @CasbinResource(SystemResource.PURCHASE_ORDERS)
  @CasbinAction('invoice')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Post Invoice',
    description: 'Post a purchase invoice',
  })
  @ApiBody({ type: EmptyBodyDto })
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async postInvoice(
    @Param('id') id: string,
    @Request() req: { user?: { username?: string } },
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoicePostingService.postInvoice(id, actor);
  }

  @ApiTags('Purchase Invoices')
  @Patch('purchase-invoices/:id/state')
  @CasbinResource(SystemResource.PURCHASE_ORDERS)
  @CasbinAction('invoice')
  @ApiOperation({
    summary: 'Change Invoice State',
    description: 'Change the state of a purchase invoice',
  })
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async changeInvoiceState(
    @Param('id') id: string,
    @Body() dto: ChangeInvoiceStateDto,
    @Request() req: { user?: { username?: string } },
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceDraftService.changePurchaseInvoiceState(
      id,
      dto.stateCode,
      actor,
      dto.discrepanciesAcknowledged,
    );
  }

  @ApiTags('Purchase Invoices')
  @Patch('purchase-invoices/:id')
  @CasbinResource(SystemResource.PURCHASE_ORDERS)
  @CasbinAction('invoice')
  @ApiOperation({
    summary: 'Update Invoice',
    description: 'Update a purchase invoice',
  })
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async updateInvoice(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseInvoiceDto,
    @Request() req: { user?: { username?: string } },
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceDraftService.updateInvoice(id, dto, actor);
  }

  @ApiTags('Purchase Invoices')
  @Patch('purchase-invoices/:id/lines/:lineId')
  @CasbinResource(SystemResource.PURCHASE_ORDERS)
  @CasbinAction('invoice')
  @ApiOperation({
    summary: 'Update Invoice Line',
    description: 'Update a specific line item on a purchase invoice',
  })
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async updateInvoiceLine(
    @Param('id') invoiceId: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateInvoiceLineDto,
    @Request() req: { user?: { username?: string } },
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceDraftService.updateLine(
      invoiceId,
      lineId,
      dto,
      actor,
    );
  }

  @ApiTags('Purchase Invoices')
  @Delete('purchase-invoices/:id/lines/:lineId')
  @CasbinResource(SystemResource.PURCHASE_ORDERS)
  @CasbinAction('invoice')
  @ApiOperation({
    summary: 'Remove Invoice Line',
    description: 'Remove a line item from a purchase invoice',
  })
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async removeInvoiceLine(
    @Param('id') invoiceId: string,
    @Param('lineId') lineId: string,
    @Request() req: { user?: { username?: string } },
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceDraftService.removeLine(
      invoiceId,
      lineId,
      actor,
    );
  }

  @ApiTags('Purchase Invoices')
  @Post('purchase-invoices/:id/lines')
  @CasbinResource(SystemResource.PURCHASE_ORDERS)
  @CasbinAction('invoice')
  @ApiOperation({
    summary: 'Add Invoice Line',
    description: 'Add a new line item to a purchase invoice',
  })
  @ApiCreatedResponse({ type: PurchaseInvoiceResponseDto })
  async addInvoiceLine(
    @Param('id') invoiceId: string,
    @Body() dto: UpdateInvoiceLineDto,
    @Request() req: { user?: { username?: string } },
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceDraftService.addLine(invoiceId, dto, actor);
  }

  @ApiTags('Purchase Invoices')
  @Post('purchase-invoices/lines/:lineId/resolve')
  @CasbinResource(SystemResource.PURCHASE_ORDERS)
  @CasbinAction('invoice')
  @ApiOperation({
    summary: 'Resolve Invoice Line',
    description: 'Resolve a discrepancy on an invoice line',
  })
  @HttpCode(200)
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async resolveInvoiceLine(
    @Param('lineId') lineId: string,
    @Body() dto: ResolveInvoiceLineDto,
    @Request() req: { user?: { username?: string } },
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoicePostingService.resolveInvoiceLine(
      lineId,
      dto.purchaseOrderLineId,
      actor,
    );
  }

  @ApiTags('Purchase Invoices')
  @Post('purchase-invoices/lines/:lineId/unresolve')
  @CasbinResource(SystemResource.PURCHASE_ORDERS)
  @CasbinAction('invoice')
  @ApiOperation({
    summary: 'Unresolve Invoice Line',
    description: 'Undo resolution of an invoice line discrepancy',
  })
  @ApiBody({ type: EmptyBodyDto })
  @HttpCode(200)
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async unresolveInvoiceLine(
    @Param('lineId') lineId: string,
    @Request() req: { user?: { username?: string } },
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoicePostingService.unresolveInvoiceLine(
      lineId,
      actor,
    );
  }

  @ApiTags('Purchase Invoices')
  @Post('purchase-invoices/:id/auto-match')
  @CasbinResource(SystemResource.PURCHASE_ORDERS)
  @CasbinAction('invoice')
  @ApiOperation({
    summary: 'Auto-Match Purchase Order',
    description: 'Automatically match a purchase order',
  })
  @HttpCode(200)
  @ApiOkResponse({ type: PurchaseInvoiceResponseDto })
  async autoMatchPurchaseOrder(
    @Param('id') invoiceId: string,
    @Body() dto: AutoMatchPurchaseOrderDto,
    @Request() req: { user?: { username?: string } },
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoicePostingService.autoMatchPurchaseOrder(
      invoiceId,
      dto.purchaseOrderId,
      actor,
    );
  }
}

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
} from '@nestjs/common';
import { SalesInvoiceService } from './sales-invoice.service';
import { PurchaseInvoiceService } from './purchase-invoice.service';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { CreateSalesInvoiceDto } from './dto';

/**
 * Sales-order–scoped invoice endpoints (AR).
 * Uses the same 'sales-orders' prefix so routes nest under that path.
 */
@Controller('sales-orders')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('sales-orders')
export class SalesInvoiceController {
  constructor(private readonly salesInvoiceService: SalesInvoiceService) {}

  @Post(':id/invoice')
  @CasbinAction('write')
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
  async getSalesInvoices(@Param('id') id: string) {
    return { data: await this.salesInvoiceService.findByOrder(id) };
  }
}

/**
 * Purchase-order–scoped invoice endpoints (AP).
 * Uses the same 'purchase-orders' prefix so routes nest under that path.
 */
@Controller('purchase-orders')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('purchase-orders')
export class PurchaseInvoiceController {
  constructor(
    private readonly purchaseInvoiceService: PurchaseInvoiceService,
  ) {}

  @Get(':id/invoices')
  @CasbinAction('read')
  async getPurchaseBills(@Param('id') id: string) {
    return { data: await this.purchaseInvoiceService.findByOrder(id) };
  }
}

/**
 * Standalone invoice detail endpoints (not scoped to an order).
 */
@Controller()
@UseGuards(AuthGuard('jwt'), CasbinGuard)
export class InvoiceDetailController {
  constructor(
    private readonly salesInvoiceService: SalesInvoiceService,
    private readonly purchaseInvoiceService: PurchaseInvoiceService,
  ) {}

  @Get('sales-invoices/:id')
  @CasbinResource('sales-orders')
  @CasbinAction('read')
  async getSalesInvoiceDetails(@Param('id') id: string) {
    return this.salesInvoiceService.findOne(id);
  }

  @Get('sales-invoices')
  @CasbinResource('sales-orders')
  @CasbinAction('read')
  async getSalesInvoicesGlobal(
    @Query('days') days?: string,
    @Query('accountId') accountId?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.salesInvoiceService.findActiveInvoices({
      days: days ? parseInt(days, 10) : undefined,
      accountId,
      invoiceId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data };
  }

  @Get('purchase-invoices')
  @CasbinResource('purchase-orders')
  @CasbinAction('read')
  async getPurchaseInvoicesGlobal(
    @Query('days') days?: string,
    @Query('vendorId') vendorId?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.purchaseInvoiceService.findActiveInvoices({
      days: days ? parseInt(days, 10) : undefined,
      vendorId,
      invoiceId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data };
  }

  @Get('purchase-invoices/:id')
  @CasbinResource('purchase-orders')
  @CasbinAction('read')
  async getPurchaseBillDetails(@Param('id') id: string) {
    return this.purchaseInvoiceService.findOne(id);
  }

  @Post('purchase-invoices')
  @CasbinResource('purchase-orders')
  @CasbinAction('write')
  async createDraftInvoice(
    @Body() dto: import('./dto').CreateStandaloneInvoiceDto,
    @Request() req: any,
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceService.createDraftInvoice(dto, actor);
  }

  @Post('purchase-invoices/:id/post')
  @CasbinResource('purchase-orders')
  @CasbinAction('write')
  async postInvoice(@Param('id') id: string, @Request() req: any) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceService.postInvoice(id, actor);
  }

  @Patch('purchase-invoices/:id/state')
  @CasbinResource('purchase-orders')
  @CasbinAction('write')
  async changeInvoiceState(
    @Param('id') id: string,
    @Body('stateCode') stateCode: string,
    @Body('discrepanciesAcknowledged')
    discrepanciesAcknowledged: boolean | undefined,
    @Request() req: any,
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceService.changePurchaseInvoiceState(
      id,
      stateCode,
      actor,
      discrepanciesAcknowledged,
    );
  }

  @Patch('purchase-invoices/:id')
  @CasbinResource('purchase-orders')
  @CasbinAction('write')
  async updateInvoice(
    @Param('id') id: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceService.updateInvoice(id, dto, actor);
  }

  @Patch('purchase-invoices/:id/lines/:lineId')
  @CasbinResource('purchase-orders')
  @CasbinAction('write')
  async updateInvoiceLine(
    @Param('id') invoiceId: string,
    @Param('lineId') lineId: string,
    @Body() dto: any,
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
  async addInvoiceLine(
    @Param('id') invoiceId: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceService.addLine(invoiceId, dto, actor);
  }

  @Post('purchase-invoices/lines/:lineId/resolve')
  @CasbinResource('purchase-orders')
  @CasbinAction('write')
  async resolveInvoiceLine(
    @Param('lineId') lineId: string,
    @Body('purchaseOrderLineId') purchaseOrderLineId: string,
    @Request() req: any,
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceService.resolveInvoiceLine(
      lineId,
      purchaseOrderLineId,
      actor,
    );
  }

  @Post('purchase-invoices/lines/:lineId/unresolve')
  @CasbinResource('purchase-orders')
  @CasbinAction('write')
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
  async autoMatchPurchaseOrder(
    @Param('id') invoiceId: string,
    @Body('purchaseOrderId') purchaseOrderId: string,
    @Request() req: any,
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceService.autoMatchPurchaseOrder(
      invoiceId,
      purchaseOrderId,
      actor,
    );
  }
}

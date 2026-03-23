import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Request,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SalesInvoiceService } from './sales-invoice.service';
import type { CreateSalesInvoiceDto } from './sales-invoice.service';
import { PurchaseInvoiceService } from './purchase-invoice.service';
import type { CreatePurchaseBillDto } from './purchase-invoice.service';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

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

  @Post(':id/invoice')
  @CasbinAction('write')
  async createPurchaseBill(
    @Param('id') id: string,
    @Body() dto: CreatePurchaseBillDto,
    @Request() req: any,
  ) {
    const actor = req.user?.username || 'system';
    return this.purchaseInvoiceService.createBill(id, dto, actor);
  }

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
@CasbinResource('sales-orders')
export class InvoiceDetailController {
  constructor(
    private readonly salesInvoiceService: SalesInvoiceService,
    private readonly purchaseInvoiceService: PurchaseInvoiceService,
  ) {}

  @Get('sales-invoices/:id')
  @CasbinAction('read')
  async getSalesInvoiceDetails(@Param('id') id: string) {
    return this.salesInvoiceService.findOne(id);
  }

  @Get('sales-invoices')
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

  @Get('purchase-invoices/:id')
  @CasbinAction('read')
  async getPurchaseBillDetails(@Param('id') id: string) {
    return this.purchaseInvoiceService.findOne(id);
  }
}

import {
  Controller,
  Get,
  Param,
  Res,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { PickingSlipService } from './picking-slip.service';
import { SalesQuoteService } from './sales-quote.service';
import { SalesInvoiceService } from './sales-invoice.service';

/**
 * Report endpoints.
 *
 * All report endpoints reuse existing Casbin resource policies
 * (e.g. 'orders' for order-related reports).
 */
@Controller('sales-orders')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('orders')
export class ReportsController {
  constructor(
    private readonly pickingSlipService: PickingSlipService,
    private readonly salesQuoteService: SalesQuoteService,
    private readonly salesInvoiceService: SalesInvoiceService,
  ) {}

  private readonly logger = new Logger(ReportsController.name);

  @Get(':id/picking-slip-report')
  @CasbinAction('read')
  async getPickingSlip(@Param('id') id: string, @Res() res: Response) {
    const { pdf, orderNumber } =
      await this.pickingSlipService.generatePickingSlip(id);

    this.logger.log(`Serving picking slip PDF for order ${orderNumber}`);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="picking-slip-${orderNumber}.pdf"`,
      'Content-Length': pdf.length.toString(),
    });
    res.send(pdf);
  }

  @Get(':id/sales-quote-report')
  @CasbinAction('read')
  async getSalesQuote(
    @Param('id') id: string,
    @Query('source') source: string,
    @Res() res: Response,
  ) {
    const { pdf, orderNumber } =
      await this.salesQuoteService.generateSalesQuote(id, source);

    this.logger.log(`Serving sales quote PDF for order ${orderNumber}`);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="sales-quote-${orderNumber}.pdf"`,
      'Content-Length': pdf.length.toString(),
    });
    res.send(pdf);
  }

  @Get(':id/sales-invoice-report')
  @CasbinAction('read')
  async getSalesInvoice(
    @Param('id') id: string,
    @Query('source') source: string,
    @Res() res: Response,
  ) {
    const { pdf, orderNumber } =
      await this.salesInvoiceService.generateSalesInvoice(id, source);

    this.logger.log(`Serving sales invoice PDF for order ${orderNumber}`);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="sales-invoice-${orderNumber}.pdf"`,
      'Content-Length': pdf.length.toString(),
    });
    res.send(pdf);
  }
}

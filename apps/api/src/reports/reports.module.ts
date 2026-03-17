import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { PickingSlipService } from './picking-slip.service';
import { SalesQuoteService } from './sales-quote.service';
import { ReportsController } from './reports.controller';
import { OrdersModule } from '../orders/orders.module';
import { SalesInvoiceService } from './sales-invoice.service';

@Module({
  imports: [OrdersModule],
  controllers: [ReportsController],
  providers: [
    ReportService,
    PickingSlipService,
    SalesQuoteService,
    SalesInvoiceService,
  ],
})
export class ReportsModule {}

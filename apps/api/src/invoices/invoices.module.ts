import { Module } from '@nestjs/common';
import { SalesInvoiceService } from './sales-invoice.service';
import { PurchaseInvoiceService } from './purchase-invoice.service';
import {
  SalesInvoiceController,
  PurchaseInvoiceController,
  InvoiceDetailController,
} from './invoices.controller';
import { OutboxSyncController } from './outbox-sync.controller';
import { GlModule } from '../gl/gl.module';
import { GstModule } from '../gst/gst.module';

@Module({
  imports: [GlModule, GstModule],
  controllers: [
    SalesInvoiceController,
    PurchaseInvoiceController,
    InvoiceDetailController,
    OutboxSyncController,
  ],
  providers: [SalesInvoiceService, PurchaseInvoiceService],
  exports: [SalesInvoiceService, PurchaseInvoiceService],
})
export class InvoicesModule {}

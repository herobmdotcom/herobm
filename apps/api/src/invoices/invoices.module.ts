import { Module } from '@nestjs/common';
import { SalesInvoiceService } from './sales-invoice.service';
import { PurchaseInvoiceService } from './purchase-invoice.service';
import {
  SalesInvoiceController,
  PurchaseInvoiceController,
  InvoiceDetailController,
} from './invoices.controller';
import { ExternalSyncController } from './external-sync.controller';
import { GlModule } from '../gl/gl.module';
import { TaxModule } from '../tax/tax.module';

@Module({
  imports: [GlModule, TaxModule],
  controllers: [
    SalesInvoiceController,
    PurchaseInvoiceController,
    InvoiceDetailController,
    ExternalSyncController,
  ],
  providers: [SalesInvoiceService, PurchaseInvoiceService],
  exports: [SalesInvoiceService, PurchaseInvoiceService],
})
export class InvoicesModule {}

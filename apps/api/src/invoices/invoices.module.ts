import { Module } from '@nestjs/common';
import { SalesInvoiceService } from './sales-invoice.service';
import { PurchaseInvoiceService } from './purchase-invoice.service';
import { SalesCreditNoteService } from './sales-credit-note.service';
import {
  SalesInvoiceController,
  PurchaseInvoiceController,
  InvoiceDetailController,
} from './invoices.controller';
import { ExternalSyncController } from './external-sync.controller';
import { GlModule } from '../gl/gl.module';
import { TaxModule } from '../tax/tax.module';
import { EnrichmentModule } from '../enrichment/enrichment.module';

@Module({
  imports: [GlModule, TaxModule, EnrichmentModule],
  controllers: [
    SalesInvoiceController,
    PurchaseInvoiceController,
    InvoiceDetailController,
    ExternalSyncController,
  ],
  providers: [
    SalesInvoiceService,
    PurchaseInvoiceService,
    SalesCreditNoteService,
  ],
  exports: [
    SalesInvoiceService,
    PurchaseInvoiceService,
    SalesCreditNoteService,
  ],
})
export class InvoicesModule {}

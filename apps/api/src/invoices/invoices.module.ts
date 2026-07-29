import { Module, forwardRef } from '@nestjs/common';
import { SalesInvoiceService } from './sales-invoice.service';
import { PurchaseInvoiceCoreService } from './purchase-invoice-core.service';
import { PurchaseInvoiceDraftService } from './purchase-invoice-draft.service';
import { PurchaseInvoicePostingService } from './purchase-invoice-posting.service';
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

import { SalesCreditNotesController } from './sales-credit-notes.controller';

@Module({
  imports: [GlModule, TaxModule, EnrichmentModule],
  controllers: [
    SalesInvoiceController,
    PurchaseInvoiceController,
    InvoiceDetailController,
    ExternalSyncController,
    SalesCreditNotesController,
  ],
  providers: [
    SalesInvoiceService,
    PurchaseInvoiceCoreService,
    PurchaseInvoiceDraftService,
    PurchaseInvoicePostingService,
    SalesCreditNoteService,
  ],
  exports: [
    SalesInvoiceService,
    PurchaseInvoiceCoreService,
    PurchaseInvoiceDraftService,
    PurchaseInvoicePostingService,
    SalesCreditNoteService,
  ],
})
export class InvoicesModule {}

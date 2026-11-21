import { Module, forwardRef } from '@nestjs/common';
import { EnrichmentModule } from '../enrichment/enrichment.module';
import { GlModule } from '../gl/gl.module';
import { OrdersModule } from '../orders/orders.module';
import { TaxModule } from '../tax/tax.module';
import { ExternalSyncController } from './external-sync.controller';
import { GlobalNotesService } from './global-notes.service';
import {
  InvoiceDetailController,
  PurchaseInvoiceController,
  SalesInvoiceController,
} from './invoices.controller';
import { PurchaseInvoiceCoreService } from './purchase-invoice-core.service';
import { PurchaseInvoiceDraftService } from './purchase-invoice-draft.service';
import { PurchaseInvoicePostingService } from './purchase-invoice-posting.service';
import { SalesCreditNoteService } from './sales-credit-note.service';
import { SalesInvoiceCreationService } from './sales-invoice-creation.service';
import { SalesInvoiceProjectService } from './sales-invoice-project.service';
import { SalesInvoiceQueryService } from './sales-invoice-query.service';
import { SalesInvoiceService } from './sales-invoice.service';

import { GlobalNotesController } from './global-notes.controller';
import { SalesCreditNotesController } from './sales-credit-notes.controller';

@Module({
  imports: [
    GlModule,
    TaxModule,
    EnrichmentModule,
    forwardRef(() => OrdersModule),
  ],
  controllers: [
    SalesInvoiceController,
    PurchaseInvoiceController,
    InvoiceDetailController,
    ExternalSyncController,
    SalesCreditNotesController,
    GlobalNotesController,
  ],
  providers: [
    SalesInvoiceService,
    SalesInvoiceCreationService,
    SalesInvoiceProjectService,
    SalesInvoiceQueryService,
    PurchaseInvoiceCoreService,
    PurchaseInvoiceDraftService,
    PurchaseInvoicePostingService,
    SalesCreditNoteService,
    GlobalNotesService,
  ],
  exports: [
    SalesInvoiceService,
    SalesInvoiceCreationService,
    SalesInvoiceProjectService,
    SalesInvoiceQueryService,
    PurchaseInvoiceCoreService,
    PurchaseInvoiceDraftService,
    PurchaseInvoicePostingService,
    SalesCreditNoteService,
    GlobalNotesService,
  ],
})
export class InvoicesModule {}

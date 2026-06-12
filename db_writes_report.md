# Database Writes and Events Audit

| File | Database Writes (Table: Action) | Events Issued |
|---|---|---|
| api-keys/api-keys.controller.ts | `apiKeys` (insert, delete) | *(None)* |
| auth/casbin/drizzle-adapter.ts | `casbinRule` (delete, insert) | *(None)* |
| business-reports/business-reports.service.ts | `businessReports` (insert, update, delete) | *(None)* |
| common/emit-event.ts | `targetTable` (insert)<br>`outbox` (insert) | `(Dynamic/Unknown)` |
| common/encryption.service.ts | `jwtSecret` (update)<br>`rawKey` (update)<br>`text, 'utf8', 'hex'` (update)<br>`encryptedText, undefined, 'utf8'` (update) | *(None)* |
| common/utils/security.util.ts | `pem.trim(` (update) | *(None)* |
| customers/customer-groups.controller.ts | `id, dto` (update)<br>`id` (delete) | *(None)* |
| customers/customer-groups.service.ts | `customerGroups` (insert, update, delete) | *(None)* |
| customers/customers-write.service.ts | `coreAccounts` (insert, update) | `EntityType.CUSTOMER` - `'created'`<br>`EntityType.CUSTOMER` - `isStatusOnly ? 'status_changed' : 'updated'`<br>`EntityType.CUSTOMER` - `eventType`<br>`EntityType.CUSTOMER` - `eventType` |
| customers/customers.controller.ts | `id, dto, user.username` (update) | *(None)* |
| email/email.controller.ts | `emailOutbox` (update) | *(None)* |
| email/email.service.ts | `emailOutbox` (insert)<br>`systemEvents` (insert)<br>`outbox` (insert) | *(None)* |
| enrichment/enrichment.service.ts | `integrations` (update, insert) | *(None)* |
| events/events.controller.ts | `outbox` (insert) | *(None)* |
| gl/bank-feeds.service.ts | `csvMappingProfiles` (insert, update, delete)<br>`reconciliationRules` (insert, update, delete)<br>`bankStatementLines` (insert, update)<br>`glJournalLines` (update)<br>`glMatchGroups` (insert) | *(None)* |
| gl/bank-statement.service.ts | `glJournalLines` (update)<br>`bankStatementLines` (update, insert, delete)<br>`glMatchGroups` (insert, delete)<br>`glJournalEntries` (update) | *(None)* |
| gl/coa-loader.service.ts | `glAccounts` (insert, update)<br>`glSettings` (insert)<br>`tradingTerms` (insert)<br>`taxCategories` (update, insert) | *(None)* |
| gl/gl.service.ts | `salesInvoices` (insert)<br>`glJournalEntries` (insert)<br>`glJournalLines` (insert)<br>`glAccounts` (insert, update)<br>`glSettings` (insert, update) | `EntityType.SYSTEM` - `EventType.GL_POSTED` |
| gl/reconciliation.service.ts | `glReconciliations` (insert, update, delete)<br>`glJournalLines` (update) | *(None)* |
| goods-received/goods-received.service.ts | `goodsReceived` (insert, update)<br>`goodsReceivedLines` (insert, update, delete)<br>`zones` (insert)<br>`bins` (insert)<br>`products` (update)<br>`purchaseOrderLineItems` (update)<br>`backorders` (update, insert) | `EntityType.WAREHOUSE` - `EventType.RECEIPT_CREATED`<br>`EntityType.PURCHASE_ORDER` - `EventType.STATUS_CHANGED`<br>`EntityType.WAREHOUSE` - `EventType.RECEIPT_STATUS_CHANGED`<br>`EntityType.SYSTEM` - `EventType.RECEIPT_MATCHED`<br>`EntityType.SYSTEM` - `EventType.RECEIPT_UNMATCHED` |
| inventory/inventory.service.ts | `inventoryEntries` (insert)<br>`inventoryLedger` (insert)<br>`binContents` (insert, delete)<br>`goodsReceivedLines` (update)<br>`salesOrderReturnLines` (update)<br>`salesOrderReturns` (update) | `EntityType.INVENTORY_LEDGER` - `EventType.ENTRY_POSTED`<br>`EntityType.WAREHOUSE` - `EventType.PUTAWAY_COMPLETED`<br>`EntityType.SALES_ORDER` - `EventType.STATUS_CHANGED`<br>`EntityType.WAREHOUSE` - `EventType.STOCK_MOVED`<br>`EntityType.WAREHOUSE` - `EventType.STOCK_MOVED`<br>`EntityType.WAREHOUSE` - `EventType.STOCK_MOVED` |
| invoices/external-sync.controller.ts | `outbox` (delete) | *(None)* |
| invoices/invoice-lifecycle-rules.ts | `table as any` (update) | `?` - `EventType.STATUS_CHANGED` |
| invoices/purchase-invoice.service.ts | `purchaseInvoices` (insert, update)<br>`purchaseInvoiceLines` (insert, update, delete)<br>`systemEvents` (insert) | `EntityType.PURCHASE_INVOICE` - `EventType.STATUS_CHANGED`<br>`EntityType.PURCHASE_ORDER` - `EventType.INVOICE_MATCHED`<br>`EntityType.PURCHASE_ORDER` - `EventType.INVOICE_MATCHED`<br>`EntityType.PURCHASE_ORDER` - `EventType.INVOICE_UNMATCHED`<br>`EntityType.PURCHASE_INVOICE` - `EventType.STATUS_CHANGED` |
| invoices/sales-credit-note.service.ts | `salesCreditNotes` (insert, update)<br>`salesCreditNoteLines` (insert)<br>`salesOrderReturns` (update) | `EntityType.SALES_ORDER` - `EventType.STATUS_CHANGED`<br>`EntityType.SALES_ORDER` - `EventType.CREDIT_NOTE_POSTED` |
| invoices/sales-invoice.service.ts | `salesInvoices` (insert, update)<br>`salesInvoiceLines` (insert) | `EntityType.SALES_ORDER` - `EventType.SALES_INVOICED`<br>`EntityType.SALES_INVOICE` - `EventType.STATUS_CHANGED` |
| locations/locations.service.ts | `locations` (insert, update, delete)<br>`appSettings` (update)<br>`bins` (delete, insert, update)<br>`zones` (delete, insert, update) | *(None)* |
| macros/macros.controller.ts | `id, updateMacroDto` (update) | *(None)* |
| macros/macros.service.ts | `schema.macros` (insert, update, delete) | *(None)* |
| orders/backorders.service.ts | `backorders` (insert, delete, update)<br>`purchaseOrders` (insert)<br>`purchaseOrderLineItems` (insert)<br>`salesOrderLineItems` (update) | `EntityType.SALES_ORDER` - `EventType.BACKORDERS_ALLOCATED`<br>`EntityType.PURCHASE_ORDER` - `EventType.DEMAND_UNALLOCATED`<br>`EntityType.PURCHASE_ORDER` - `EventType.CREATED`<br>`EntityType.PURCHASE_ORDER` - `EventType.DEMAND_ALLOCATED`<br>`EntityType.PURCHASE_ORDER` - `EventType.DEMAND_UNALLOCATED`<br>`EntityType.SALES_ORDER` - `EventType.DEMAND_REALLOCATED`<br>`EntityType.SALES_ORDER` - `EventType.STATUS_CHANGED` |
| orders/order-lifecycle-rules.ts | `salesOrders` (update) | `EntityType.SALES_ORDER` - `'auto_status_changed'`<br>`EntityType.SALES_ORDER` - `'auto_status_changed'`<br>`EntityType.SALES_ORDER` - `'auto_status_changed'`<br>`EntityType.SALES_ORDER` - `'auto_status_changed'` |
| orders/orders-write.service.ts | `salesOrders` (update, insert)<br>`salesOrderLineItems` (insert, update, delete)<br>`backorders` (update, delete) | `EntityType.SALES_ORDER` - `EventType.CREATED`<br>`EntityType.SALES_ORDER` - `EventType.UPDATED`<br>`EntityType.SALES_ORDER` - `eventType`<br>`EntityType.SALES_ORDER` - `'TAX_CALCULATED' as string`<br>`EntityType.SALES_ORDER` - `EventType.LINE_ADDED`<br>`EntityType.SALES_ORDER` - `EventType.POST_CONFIRMATION_LINE_ADDED`<br>`EntityType.SALES_ORDER` - `EventType.LINE_UPDATED`<br>`EntityType.SALES_ORDER` - `EventType.LINE_REMOVED` |
| orders/orders.controller.ts | `id, body, user.username` (update) | *(None)* |
| orders/picking.service.ts | `salesOrderPicks` (insert, update)<br>`salesOrders` (update) | `EntityType.WAREHOUSE` - `EventType.PICK_CREATED`<br>`EntityType.WAREHOUSE` - `EventType.PICK_CANCELLED` |
| orders/returns-write.service.ts | `salesOrderReturns` (insert, update)<br>`salesOrderReturnLines` (insert, update, delete) | `EntityType.SALES_ORDER` - `EventType.RETURN_CREATED`<br>`EntityType.SALES_ORDER` - `'return_updated'`<br>`EntityType.SALES_ORDER` - `EventType.STATUS_CHANGED`<br>`EntityType.SALES_ORDER` - `'return_line_added'`<br>`EntityType.SALES_ORDER` - `'return_line_updated'`<br>`EntityType.SALES_ORDER` - `'return_line_removed'` |
| orders/shipment.service.ts | `salesOrderShipments` (insert, update)<br>`salesOrderShipmentLines` (insert, update, delete)<br>`salesOrderPicks` (update, insert) | `EntityType.SHIPMENT` - `'shipment_created'`<br>`EntityType.SHIPMENT` - `'shipment_updated'`<br>`EntityType.SHIPMENT` - `?`<br>`EntityType.SHIPMENT` - `'shipment_line_added'`<br>`EntityType.SHIPMENT` - `'shipment_line_updated'`<br>`EntityType.SHIPMENT` - `'shipment_line_removed'`<br>`EntityType.SHIPMENT` - `EventType.STOCK_DISPATCHED`<br>`EntityType.WAREHOUSE` - `EventType.PICK_CANCELLED` |
| orders/transfers/transfers.controller.ts | `id, body, user.username` (update) | *(None)* |
| orders/transfers/transfers.service.ts | `transferOrders` (insert, update)<br>`transferOrderLines` (insert, update, delete)<br>`backorders` (update)<br>`transferOrderPicks` (insert, update)<br>`transferOrderShipments` (insert, update)<br>`transferOrderShipmentLines` (insert)<br>`transferOrderReceipts` (insert)<br>`transferOrderReceiptLines` (insert) | `EntityType.TRANSFER_ORDER` - `EventType.CREATED`<br>`EntityType.WAREHOUSE` - `EventType.PICK_CREATED`<br>`'transfer_order' as any` - `EventType.LINE_REMOVED`<br>`EntityType.TRANSFER_ORDER` - `EventType.STOCK_DISPATCHED`<br>`EntityType.TRANSFER_ORDER` - `EventType.STATUS_CHANGED`<br>`EntityType.TRANSFER_ORDER` - `EventType.UPDATED`<br>`EntityType.TRANSFER_ORDER` - `EventType.STATUS_CHANGED`<br>`EntityType.WAREHOUSE` - `EventType.PICK_CANCELLED`<br>`EntityType.TRANSFER_ORDER` - `EventType.UPDATED`<br>`EntityType.TRANSFER_ORDER` - `EventType.LINE_REMOVED` |
| payments/payments.service.ts | `paymentEntries` (insert, update)<br>`paymentLines` (insert)<br>`paymentAllocations` (insert)<br>`targetTable` (update) | `EntityType.PAYMENT` - `EventType.PAYMENT_ALLOCATED`<br>`EntityType.PAYMENT` - `EventType.STATUS_CHANGED` |
| pdf-templates/pdf-templates.service.ts | `pdfTemplates` (insert, update, delete)<br>`pdfTemplateContexts` (insert, delete)<br>`pdfTemplateHooks` (insert) | *(None)* |
| pricing/discount-matrix.controller.ts | `id, dto` (update)<br>`id` (delete) | *(None)* |
| pricing/discount-matrix.service.ts | `discountMatrix` (insert, update, delete) | *(None)* |
| products/product-groups.controller.ts | `id, dto` (update)<br>`id` (delete) | *(None)* |
| products/product-groups.service.ts | `productGroups` (insert, update, delete) | *(None)* |
| products/products-write.service.ts | `coreProducts` (insert, update)<br>`productSuppliers` (insert, update)<br>`productUoms` (insert, delete)<br>`productDefaultBins` (update, insert, delete)<br>`productComponents` (insert, update, delete) | `EntityType.PRODUCT` - `EventType.CREATED`<br>`EntityType.PRODUCT` - `EventType.STATUS_CHANGED`<br>`EntityType.PRODUCT` - `EventType.UPDATED`<br>`EntityType.PRODUCT` - `eventType`<br>`EntityType.PRODUCT_SUPPLIER` - `EventType.LINKED`<br>`EntityType.PRODUCT_SUPPLIER` - `EventType.UNLINKED`<br>`EntityType.PRODUCT` - `'uom_added'`<br>`EntityType.PRODUCT` - `'uom_removed'`<br>`EntityType.PRODUCT` - `EventType.UPDATED`<br>`EntityType.PRODUCT` - `EventType.UPDATED`<br>`EntityType.PRODUCT` - `EventType.UPDATED`<br>`EntityType.PRODUCT` - `EventType.UPDATED`<br>`EntityType.PRODUCT` - `EventType.UPDATED` |
| products/products.controller.ts | `id, dto, user.username` (update) | *(None)* |
| purchase-debit-notes/purchase-debit-notes.service.ts | `purchaseDebitNotes` (insert, update)<br>`purchaseDebitNoteLines` (insert) | `EntityType.PURCHASE_ORDER` - `EventType.CREATED`<br>`EntityType.PURCHASE_ORDER` - `EventType.STATUS_CHANGED` |
| purchase-orders/purchase-order-lifecycle-rules.ts | `purchaseOrders` (update) | `EntityType.PURCHASE_ORDER` - `EventType.STATUS_CHANGED`<br>`EntityType.PURCHASE_ORDER` - `EventType.STATUS_CHANGED`<br>`EntityType.PURCHASE_ORDER` - `EventType.STATUS_CHANGED`<br>`EntityType.PURCHASE_ORDER` - `EventType.STATUS_CHANGED` |
| purchase-orders/purchase-orders.service.ts | `purchaseOrders` (insert, update)<br>`purchaseOrderLineItems` (insert, update, delete)<br>`backorders` (update) | `EntityType.PURCHASE_ORDER` - `EventType.CREATED`<br>`EntityType.PURCHASE_ORDER` - `EventType.LINE_ADDED`<br>`EntityType.PURCHASE_ORDER` - `EventType.LINE_UPDATED`<br>`EntityType.PURCHASE_ORDER` - `EventType.LINE_REMOVED`<br>`EntityType.PURCHASE_ORDER` - `EventType.UPDATED`<br>`EntityType.PURCHASE_ORDER` - `eventType` |
| purchase-orders/purchase-returns.service.ts | `purchaseOrderReturns` (insert, update)<br>`purchaseOrderReturnLines` (insert)<br>`purchaseOrderReturnShipments` (insert)<br>`purchaseOrderReturnShipmentLines` (insert) | `EntityType.PURCHASE_ORDER` - `EventType.RETURN_CREATED`<br>`EntityType.PURCHASE_ORDER` - `EventType.STATUS_CHANGED`<br>`EntityType.PURCHASE_ORDER` - `EventType.STATUS_CHANGED`<br>`EntityType.PURCHASE_ORDER` - `EventType.STATUS_CHANGED` |
| scripts/fix-countries-currencies.ts | `customers` (update)<br>`suppliers` (update) | *(None)* |
| scripts/seed-business-reports.ts | `businessReports` (insert, update) | *(None)* |
| scripts/seed-demo.ts | `locations` (insert)<br>`zones` (insert)<br>`bins` (insert)<br>`suppliers` (insert)<br>`customers` (insert)<br>`uomDictionary` (insert)<br>`products` (insert)<br>`purchaseOrders` (insert)<br>`purchaseOrderLineItems` (insert)<br>`inventoryEntries` (insert)<br>`inventoryLedger` (insert)<br>`binContents` (insert)<br>`salesOrders` (insert)<br>`salesOrderLineItems` (insert)<br>`salesOrderPicks` (insert)<br>`salesOrderShipments` (insert) | *(None)* |
| scripts/seed-dynamic-reports.ts | `pdfTemplateHooks` (delete, insert)<br>`pdfTemplateContexts` (delete, insert)<br>`pdfTemplates` (delete, insert) | *(None)* |
| scripts/seed.ts | `nsBuffer` (update)<br>`nameBuffer` (update)<br>`casbinRule` (delete, insert)<br>`users` (insert)<br>`uomDictionary` (insert)<br>`products` (insert)<br>`costCenters` (insert)<br>`activities` (insert)<br>`organization` (insert)<br>`appSettings` (insert)<br>`glSettings` (insert)<br>`glAccounts` (insert, update)<br>`taxCategories` (insert)<br>`tradingTerms` (insert)<br>`pdfTemplates` (insert)<br>`pdfTemplateHooks` (insert)<br>`pdfTemplateContexts` (insert)<br>`customers` (insert)<br>`suppliers` (insert) | *(None)* |
| settings/activities.controller.ts | `id, dto` (update)<br>`id` (delete) | *(None)* |
| settings/activities.service.ts | `activities` (insert, update, delete) | *(None)* |
| settings/app-config.controller.ts | `updatePayload` (update) | *(None)* |
| settings/app-config.service.ts | `appSettings` (update) | *(None)* |
| settings/cost-centers.controller.ts | `id, dto` (update)<br>`id` (delete) | *(None)* |
| settings/cost-centers.service.ts | `costCenters` (insert, update, delete) | *(None)* |
| settings/exchange-rates.controller.ts | `id, dto` (update)<br>`id` (delete) | *(None)* |
| settings/exchange-rates.service.ts | `exchangeRates` (insert, update, delete) | *(None)* |
| settings/license.service.ts | `pem.trim(` (update)<br>`activeLicenseKey` (update) | *(None)* |
| settings/organization.controller.ts | `dto` (update) | *(None)* |
| settings/organization.service.ts | `organization` (insert, update) | *(None)* |
| settings/uom-dictionary.controller.ts | `code, dto` (update)<br>`code` (delete) | *(None)* |
| settings/uom-dictionary.service.ts | `uomDictionary` (insert, update, delete) | *(None)* |
| setup/setup.service.ts | `entry.table` (insert)<br>`glSettings` (update)<br>`appSettings` (update) | *(None)* |
| suppliers/supplier-groups.controller.ts | `id, dto` (update)<br>`id` (delete) | *(None)* |
| suppliers/supplier-groups.service.ts | `supplierGroups` (insert, update, delete) | *(None)* |
| suppliers/suppliers-write.service.ts | `coreSuppliers` (insert, update)<br>`supplierExpiries` (insert, update, delete) | `EntityType.SUPPLIER` - `EventType.CREATED`<br>`EntityType.SUPPLIER` - `EventType.STATUS_CHANGED`<br>`EntityType.SUPPLIER` - `EventType.UPDATED`<br>`EntityType.SUPPLIER` - `eventType`<br>`EntityType.SUPPLIER` - `EventType.ADDED_EXPIRY`<br>`EntityType.SUPPLIER` - `EventType.UPDATED_EXPIRY`<br>`EntityType.SUPPLIER` - `EventType.DELETED_EXPIRY` |
| suppliers/suppliers.controller.ts | `id, dto, user.username` (update) | *(None)* |
| suppliers/suppliers.service.ts | `coreSuppliers` (update) | *(None)* |
| tax/tax-categories.controller.ts | `id, dto` (update)<br>`id` (delete) | *(None)* |
| tax/tax-categories.service.ts | `taxCategories` (update, insert, delete) | *(None)* |
| user-settings/user-settings.service.ts | `userSettings` (insert, update) | *(None)* |
| users/users.controller.ts | `id, dto, user.userId, user.username` (update) | *(None)* |
| users/users.service.ts | `users` (insert, update, delete)<br>`userEvents` (insert) | *(None)* |
| webhooks/webhooks.controller.ts | `webhooks` (insert, update, delete) | *(None)* |

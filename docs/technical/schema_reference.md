# Schema Reference — `herobm_core`

> Auto-generated from live Postgres introspection. Last generated: 2026-06-25 07:29 UTC
> Regenerate with: `make schema-ref`

**Postgres schema:** `herobm_core`

All tables are managed by Drizzle ORM with UUID primary keys and enforced FK constraints.

## Tables

| Table | Rows | PK | Description |
|-------|------|----|-------------|
| [`_pipeline_jobs`](#_pipeline_jobs) | 25 | `job_id` | |
| [`activities`](#activities) | 76 | `activity_id` | |
| [`api_keys`](#api_keys) | 0 | `api_key_id` | |
| [`app_settings`](#app_settings) | 0 | `settings_id` | |
| [`backorders`](#backorders) | 0 | `backorder_id` | |
| [`bank_statement_lines`](#bank_statement_lines) | 0 | `line_id` | |
| [`bin_contents`](#bin_contents) | 12,623 | `bin_content_id` | |
| [`bins`](#bins) | 12,656 | `bin_id` | |
| [`business_report_events`](#business_report_events) | 0 | `event_id` | |
| [`business_reports`](#business_reports) | 0 | `id` | |
| [`casbin_rule`](#casbin_rule) | 161 | `id` | |
| [`cost_centers`](#cost_centers) | 37 | `cost_center_id` | |
| [`csv_mapping_profiles`](#csv_mapping_profiles) | 0 | `profile_id` | |
| [`customer_contacts`](#customer_contacts) | 3,364 | `id` | |
| [`customer_delivery_addresses`](#customer_delivery_addresses) | 2,095 | `id` | |
| [`customer_groups`](#customer_groups) | 14 | `customer_group_id` | |
| [`customers`](#customers) | 1,435 | `customer_id` | |
| [`discount_matrix`](#discount_matrix) | 0 | `discount_matrix_id` | |
| [`email_events`](#email_events) | 0 | `event_id` | |
| [`email_outbox`](#email_outbox) | 8 | `id` | |
| [`exchange_rates`](#exchange_rates) | 10 | `exchange_rate_id` | |
| [`financial_events`](#financial_events) | 20 | `event_id` | |
| [`gl_accounts`](#gl_accounts) | 119 | `gl_account_id` | |
| [`gl_journal_entries`](#gl_journal_entries) | 7 | `journal_entry_id` | |
| [`gl_journal_lines`](#gl_journal_lines) | 166 | `journal_line_id` | |
| [`gl_match_groups`](#gl_match_groups) | 0 | `match_group_id` | |
| [`gl_reconciliations`](#gl_reconciliations) | 0 | `reconciliation_id` | |
| [`gl_settings`](#gl_settings) | 0 | `settings_id` | |
| [`goods_received`](#goods_received) | 0 | `goods_received_id` | |
| [`goods_received_lines`](#goods_received_lines) | 0 | `goods_received_line_id` | |
| [`group_events`](#group_events) | 0 | `event_id` | |
| [`import_abm_sales_quotes`](#import_abm_sales_quotes) | 8,740 | — | |
| [`integration_events`](#integration_events) | 0 | `event_id` | |
| [`integrations`](#integrations) | 0 | `integration_id` | |
| [`inventory_entries`](#inventory_entries) | 12,003 | `entry_id` | |
| [`inventory_events`](#inventory_events) | 0 | `event_id` | |
| [`inventory_ledger`](#inventory_ledger) | 11,483 | `ledger_id` | |
| [`locations`](#locations) | 11 | `location_id` | |
| [`macros`](#macros) | 0 | `macro_id` | |
| [`master_data_events`](#master_data_events) | 153 | `event_id` | |
| [`organization`](#organization) | 0 | `organization_id` | |
| [`outbox`](#outbox) | 97 | `outbox_id` | |
| [`payment_allocations`](#payment_allocations) | 2 | `allocation_id` | |
| [`payment_entries`](#payment_entries) | 2 | `payment_id` | |
| [`payment_lines`](#payment_lines) | 0 | `payment_line_id` | |
| [`pdf_template_contexts`](#pdf_template_contexts) | 0 | `context`, `template_id` | |
| [`pdf_template_hooks`](#pdf_template_hooks) | 0 | `id` | |
| [`pdf_templates`](#pdf_templates) | 0 | `id` | |
| [`procurement_events`](#procurement_events) | 54 | `event_id` | |
| [`product_components`](#product_components) | 12,435 | `component_id` | |
| [`product_default_bins`](#product_default_bins) | 12,796 | `product_default_bin_id` | |
| [`product_groups`](#product_groups) | 19 | `product_group_id` | |
| [`product_suppliers`](#product_suppliers) | 18,668 | `product_supplier_id` | |
| [`product_uoms`](#product_uoms) | 22,975 | `product_uom_id` | |
| [`products`](#products) | 23,001 | `product_id` | |
| [`purchase_debit_note_lines`](#purchase_debit_note_lines) | 0 | `debit_note_line_id` | |
| [`purchase_debit_notes`](#purchase_debit_notes) | 0 | `debit_note_id` | |
| [`purchase_invoice_lines`](#purchase_invoice_lines) | 189,058 | `invoice_line_id` | |
| [`purchase_invoice_receipts`](#purchase_invoice_receipts) | 0 | `invoice_receipt_id` | |
| [`purchase_invoices`](#purchase_invoices) | 31,458 | — | |
| [`purchase_order_lines`](#purchase_order_lines) | 16,302 | `purchase_order_line_id` | |
| [`purchase_order_return_lines`](#purchase_order_return_lines) | 0 | `return_line_id` | |
| [`purchase_order_return_shipment_lines`](#purchase_order_return_shipment_lines) | 0 | `shipment_line_id` | |
| [`purchase_order_return_shipments`](#purchase_order_return_shipments) | 0 | `shipment_id` | |
| [`purchase_order_returns`](#purchase_order_returns) | 0 | `return_id` | |
| [`purchase_orders`](#purchase_orders) | 1,525 | `purchase_order_id` | |
| [`reconciliation_events`](#reconciliation_events) | 0 | `event_id` | |
| [`reconciliation_rules`](#reconciliation_rules) | 0 | `rule_id` | |
| [`sales_credit_note_lines`](#sales_credit_note_lines) | 0 | `credit_note_line_id` | |
| [`sales_credit_notes`](#sales_credit_notes) | 0 | `credit_note_id` | |
| [`sales_events`](#sales_events) | 254 | `event_id` | |
| [`sales_invoice_lines`](#sales_invoice_lines) | 102,346 | `invoice_line_id` | |
| [`sales_invoices`](#sales_invoices) | 12,332 | — | |
| [`sales_order_lines`](#sales_order_lines) | 228,825 | `sales_order_line_id` | |
| [`sales_order_picks`](#sales_order_picks) | 0 | `pick_id` | |
| [`sales_order_return_lines`](#sales_order_return_lines) | 0 | `return_line_id` | |
| [`sales_order_returns`](#sales_order_returns) | 0 | `return_id` | |
| [`sales_order_shipment_lines`](#sales_order_shipment_lines) | 1 | `shipment_line_id` | |
| [`sales_order_shipments`](#sales_order_shipments) | 1 | `shipment_id` | |
| [`sales_orders`](#sales_orders) | 17,585 | `sales_order_id` | |
| [`schema_migrations`](#schema_migrations) | 0 | `filename` | |
| [`supplier_expiries`](#supplier_expiries) | 0 | `expiry_id` | |
| [`supplier_groups`](#supplier_groups) | 0 | `supplier_group_id` | |
| [`suppliers`](#suppliers) | 365 | `vendor_id` | |
| [`system_events`](#system_events) | 39 | `event_id` | |
| [`tax_categories`](#tax_categories) | 0 | `tax_category_id` | |
| [`tax_position_mappings`](#tax_position_mappings) | 0 | `mapping_id` | |
| [`tax_positions`](#tax_positions) | 0 | `tax_position_id` | |
| [`trading_terms`](#trading_terms) | 43 | `trading_terms_id` | |
| [`transfer_order_lines`](#transfer_order_lines) | 0 | `transfer_order_line_id` | |
| [`transfer_order_picks`](#transfer_order_picks) | 0 | `pick_id` | |
| [`transfer_order_receipt_lines`](#transfer_order_receipt_lines) | 0 | `receipt_line_id` | |
| [`transfer_order_receipts`](#transfer_order_receipts) | 0 | `receipt_id` | |
| [`transfer_order_shipment_lines`](#transfer_order_shipment_lines) | 0 | `shipment_line_id` | |
| [`transfer_order_shipments`](#transfer_order_shipments) | 0 | `shipment_id` | |
| [`transfer_orders`](#transfer_orders) | 0 | `transfer_order_id` | |
| [`uom_dictionary`](#uom_dictionary) | 1 | `uom_code` | |
| [`user_events`](#user_events) | 0 | `event_id` | |
| [`user_settings`](#user_settings) | 0 | `user_id` | |
| [`users`](#users) | 0 | `user_id` | |
| [`warehouse_events`](#warehouse_events) | 10 | `event_id` | |
| [`webhooks`](#webhooks) | 0 | `webhook_id` | |
| [`zones`](#zones) | 12 | `zone_id` | |

---

## Foreign Key Relationships

| From Table | Column | → To Table | Column |
|-----------|--------|-----------|--------|
| `app_settings` | `default_customer_tax_position_id` | `tax_positions` | `tax_position_id` |
| `app_settings` | `default_customer_terms_id` | `trading_terms` | `trading_terms_id` |
| `app_settings` | `default_fulfillment_location_id` | `locations` | `location_id` |
| `app_settings` | `default_purchase_tax_category_id` | `tax_categories` | `tax_category_id` |
| `app_settings` | `default_sales_tax_category_id` | `tax_categories` | `tax_category_id` |
| `app_settings` | `default_supplier_tax_position_id` | `tax_positions` | `tax_position_id` |
| `app_settings` | `default_supplier_terms_id` | `trading_terms` | `trading_terms_id` |
| `backorders` | `product_id` | `products` | `product_id` |
| `backorders` | `purchase_order_id` | `purchase_orders` | `purchase_order_id` |
| `backorders` | `purchase_order_line_id` | `purchase_order_lines` | `purchase_order_line_id` |
| `backorders` | `sales_order_id` | `sales_orders` | `sales_order_id` |
| `backorders` | `sales_order_line_id` | `sales_order_lines` | `sales_order_line_id` |
| `backorders` | `transfer_order_id` | `transfer_orders` | `transfer_order_id` |
| `backorders` | `transfer_order_line_id` | `transfer_order_lines` | `transfer_order_line_id` |
| `bank_statement_lines` | `gl_account_id` | `gl_accounts` | `gl_account_id` |
| `bank_statement_lines` | `matched_journal_line_id` | `gl_journal_lines` | `journal_line_id` |
| `bank_statement_lines` | `reconciliation_id` | `gl_reconciliations` | `reconciliation_id` |
| `bin_contents` | `bin_id` | `bins` | `bin_id` |
| `bin_contents` | `product_id` | `products` | `product_id` |
| `bins` | `zone_id` | `zones` | `zone_id` |
| `customer_contacts` | `customer_id` | `customers` | `customer_id` |
| `customer_delivery_addresses` | `customer_id` | `customers` | `customer_id` |
| `customer_groups` | `default_activity_id` | `activities` | `activity_id` |
| `customer_groups` | `default_ar_account_id` | `gl_accounts` | `gl_account_id` |
| `customer_groups` | `default_cost_center_id` | `cost_centers` | `cost_center_id` |
| `customer_groups` | `default_revenue_account_id` | `gl_accounts` | `gl_account_id` |
| `customer_groups` | `tax_position_id` | `tax_positions` | `tax_position_id` |
| `customer_groups` | `trading_terms_id` | `trading_terms` | `trading_terms_id` |
| `customers` | `customer_group_id` | `customer_groups` | `customer_group_id` |
| `customers` | `tax_position_id` | `tax_positions` | `tax_position_id` |
| `customers` | `trading_terms_id` | `trading_terms` | `trading_terms_id` |
| `discount_matrix` | `customer_group_id` | `customer_groups` | `customer_group_id` |
| `discount_matrix` | `customer_id` | `customers` | `customer_id` |
| `discount_matrix` | `product_group_id` | `product_groups` | `product_group_id` |
| `gl_journal_lines` | `activity_id` | `activities` | `activity_id` |
| `gl_journal_lines` | `cost_center_id` | `cost_centers` | `cost_center_id` |
| `gl_journal_lines` | `gl_account_id` | `gl_accounts` | `gl_account_id` |
| `gl_journal_lines` | `journal_entry_id` | `gl_journal_entries` | `journal_entry_id` |
| `gl_journal_lines` | `reconciliation_id` | `gl_reconciliations` | `reconciliation_id` |
| `gl_match_groups` | `rule_id` | `reconciliation_rules` | `rule_id` |
| `gl_reconciliations` | `gl_account_id` | `gl_accounts` | `gl_account_id` |
| `gl_settings` | `default_activity_id` | `activities` | `activity_id` |
| `gl_settings` | `default_ap_account_id` | `gl_accounts` | `gl_account_id` |
| `gl_settings` | `default_ar_account_id` | `gl_accounts` | `gl_account_id` |
| `gl_settings` | `default_cogs_account_id` | `gl_accounts` | `gl_account_id` |
| `gl_settings` | `default_cost_center_id` | `cost_centers` | `cost_center_id` |
| `gl_settings` | `default_discounts_given_account_id` | `gl_accounts` | `gl_account_id` |
| `gl_settings` | `default_discounts_received_account_id` | `gl_accounts` | `gl_account_id` |
| `gl_settings` | `default_expense_account_id` | `gl_accounts` | `gl_account_id` |
| `gl_settings` | `default_fee_revenue_account_id` | `gl_accounts` | `gl_account_id` |
| `gl_settings` | `default_grni_account_id` | `gl_accounts` | `gl_account_id` |
| `gl_settings` | `default_inventory_account_id` | `gl_accounts` | `gl_account_id` |
| `gl_settings` | `default_ppv_account_id` | `gl_accounts` | `gl_account_id` |
| `gl_settings` | `default_revenue_account_id` | `gl_accounts` | `gl_account_id` |
| `gl_settings` | `default_shrinkage_account_id` | `gl_accounts` | `gl_account_id` |
| `gl_settings` | `default_tax_account_id` | `gl_accounts` | `gl_account_id` |
| `gl_settings` | `realised_fx_gain_account_id` | `gl_accounts` | `gl_account_id` |
| `gl_settings` | `realised_fx_loss_account_id` | `gl_accounts` | `gl_account_id` |
| `gl_settings` | `unrealised_fx_gain_account_id` | `gl_accounts` | `gl_account_id` |
| `gl_settings` | `unrealised_fx_loss_account_id` | `gl_accounts` | `gl_account_id` |
| `goods_received` | `location_id` | `locations` | `location_id` |
| `goods_received` | `vendor_id` | `suppliers` | `vendor_id` |
| `goods_received_lines` | `goods_received_id` | `goods_received` | `goods_received_id` |
| `goods_received_lines` | `product_id` | `products` | `product_id` |
| `goods_received_lines` | `purchase_order_id` | `purchase_orders` | `purchase_order_id` |
| `goods_received_lines` | `purchase_order_line_id` | `purchase_order_lines` | `purchase_order_line_id` |
| `inventory_ledger` | `bin_id` | `bins` | `bin_id` |
| `inventory_ledger` | `entry_id` | `inventory_entries` | `entry_id` |
| `inventory_ledger` | `location_id` | `locations` | `location_id` |
| `inventory_ledger` | `product_id` | `products` | `product_id` |
| `inventory_ledger` | `zone_id` | `zones` | `zone_id` |
| `payment_allocations` | `payment_id` | `payment_entries` | `payment_id` |
| `payment_entries` | `gl_account_bank` | `gl_accounts` | `gl_account_id` |
| `payment_lines` | `gl_account_id` | `gl_accounts` | `gl_account_id` |
| `payment_lines` | `payment_id` | `payment_entries` | `payment_id` |
| `pdf_template_contexts` | `template_id` | `pdf_templates` | `id` |
| `pdf_template_hooks` | `report_id` | `pdf_templates` | `id` |
| `product_components` | `child_product_id` | `products` | `product_id` |
| `product_components` | `parent_product_id` | `products` | `product_id` |
| `product_default_bins` | `bin_id` | `bins` | `bin_id` |
| `product_default_bins` | `location_id` | `locations` | `location_id` |
| `product_default_bins` | `product_id` | `products` | `product_id` |
| `product_groups` | `default_activity_id` | `activities` | `activity_id` |
| `product_groups` | `default_cost_center_id` | `cost_centers` | `cost_center_id` |
| `product_groups` | `default_expense_account_id` | `gl_accounts` | `gl_account_id` |
| `product_groups` | `default_revenue_account_id` | `gl_accounts` | `gl_account_id` |
| `product_groups` | `purchase_tax_category_id` | `tax_categories` | `tax_category_id` |
| `product_groups` | `sales_tax_category_id` | `tax_categories` | `tax_category_id` |
| `product_suppliers` | `product_id` | `products` | `product_id` |
| `product_suppliers` | `vendor_id` | `suppliers` | `vendor_id` |
| `product_uoms` | `product_id` | `products` | `product_id` |
| `product_uoms` | `uom_code` | `uom_dictionary` | `uom_code` |
| `products` | `base_uom` | `uom_dictionary` | `uom_code` |
| `products` | `product_group_id` | `product_groups` | `product_group_id` |
| `products` | `purchase_tax_category_id` | `tax_categories` | `tax_category_id` |
| `products` | `sales_tax_category_id` | `tax_categories` | `tax_category_id` |
| `purchase_debit_note_lines` | `debit_note_id` | `purchase_debit_notes` | `debit_note_id` |
| `purchase_debit_note_lines` | `purchase_order_line_id` | `purchase_order_lines` | `purchase_order_line_id` |
| `purchase_debit_notes` | `purchase_order_id` | `purchase_orders` | `purchase_order_id` |
| `purchase_debit_notes` | `return_id` | `purchase_order_returns` | `return_id` |
| `purchase_debit_notes` | `vendor_id` | `suppliers` | `vendor_id` |
| `purchase_invoice_lines` | `gl_account_id` | `gl_accounts` | `gl_account_id` |
| `purchase_invoice_lines` | `product_id` | `products` | `product_id` |
| `purchase_invoice_lines` | `purchase_order_line_id` | `purchase_order_lines` | `purchase_order_line_id` |
| `purchase_invoice_receipts` | `goods_received_line_id` | `goods_received_lines` | `goods_received_line_id` |
| `purchase_invoice_receipts` | `invoice_line_id` | `purchase_invoice_lines` | `invoice_line_id` |
| `purchase_order_lines` | `product_id` | `products` | `product_id` |
| `purchase_order_lines` | `purchase_order_id` | `purchase_orders` | `purchase_order_id` |
| `purchase_order_lines` | `tax_category_id` | `tax_categories` | `tax_category_id` |
| `purchase_order_return_lines` | `purchase_order_line_id` | `purchase_order_lines` | `purchase_order_line_id` |
| `purchase_order_return_lines` | `return_id` | `purchase_order_returns` | `return_id` |
| `purchase_order_return_shipment_lines` | `return_line_id` | `purchase_order_return_lines` | `return_line_id` |
| `purchase_order_return_shipment_lines` | `shipment_id` | `purchase_order_return_shipments` | `shipment_id` |
| `purchase_order_return_shipments` | `fulfillment_location_id` | `locations` | `location_id` |
| `purchase_order_return_shipments` | `return_id` | `purchase_order_returns` | `return_id` |
| `purchase_order_returns` | `purchase_order_id` | `purchase_orders` | `purchase_order_id` |
| `purchase_orders` | `delivery_location_id` | `locations` | `location_id` |
| `purchase_orders` | `vendor_id` | `suppliers` | `vendor_id` |
| `reconciliation_rules` | `activity_id` | `activities` | `activity_id` |
| `reconciliation_rules` | `cost_center_id` | `cost_centers` | `cost_center_id` |
| `reconciliation_rules` | `target_gl_account_id` | `gl_accounts` | `gl_account_id` |
| `sales_credit_note_lines` | `account_id` | `gl_accounts` | `gl_account_id` |
| `sales_credit_note_lines` | `credit_note_id` | `sales_credit_notes` | `credit_note_id` |
| `sales_credit_note_lines` | `sales_order_line_id` | `sales_order_lines` | `sales_order_line_id` |
| `sales_credit_note_lines` | `tax_category_id` | `tax_categories` | `tax_category_id` |
| `sales_credit_notes` | `customer_id` | `customers` | `customer_id` |
| `sales_credit_notes` | `return_id` | `sales_order_returns` | `return_id` |
| `sales_credit_notes` | `sales_order_id` | `sales_orders` | `sales_order_id` |
| `sales_invoice_lines` | `sales_order_line_id` | `sales_order_lines` | `sales_order_line_id` |
| `sales_order_lines` | `fulfillment_location_id` | `locations` | `location_id` |
| `sales_order_lines` | `parent_line_id` | `sales_order_lines` | `sales_order_line_id` |
| `sales_order_lines` | `product_id` | `products` | `product_id` |
| `sales_order_lines` | `sales_order_id` | `sales_orders` | `sales_order_id` |
| `sales_order_lines` | `tax_category_id` | `tax_categories` | `tax_category_id` |
| `sales_order_picks` | `bin_id` | `bins` | `bin_id` |
| `sales_order_picks` | `product_id` | `products` | `product_id` |
| `sales_order_picks` | `sales_order_id` | `sales_orders` | `sales_order_id` |
| `sales_order_picks` | `sales_order_line_id` | `sales_order_lines` | `sales_order_line_id` |
| `sales_order_return_lines` | `return_id` | `sales_order_returns` | `return_id` |
| `sales_order_return_lines` | `sales_order_line_id` | `sales_order_lines` | `sales_order_line_id` |
| `sales_order_returns` | `sales_order_id` | `sales_orders` | `sales_order_id` |
| `sales_order_shipment_lines` | `sales_order_line_id` | `sales_order_lines` | `sales_order_line_id` |
| `sales_order_shipment_lines` | `shipment_id` | `sales_order_shipments` | `shipment_id` |
| `sales_order_shipments` | `fulfillment_location_id` | `locations` | `location_id` |
| `sales_order_shipments` | `sales_order_id` | `sales_orders` | `sales_order_id` |
| `sales_orders` | `customer_id` | `customers` | `customer_id` |
| `sales_orders` | `fulfillment_location_id` | `locations` | `location_id` |
| `supplier_expiries` | `vendor_id` | `suppliers` | `vendor_id` |
| `supplier_groups` | `default_activity_id` | `activities` | `activity_id` |
| `supplier_groups` | `default_ap_account_id` | `gl_accounts` | `gl_account_id` |
| `supplier_groups` | `default_cost_center_id` | `cost_centers` | `cost_center_id` |
| `supplier_groups` | `default_expense_account_id` | `gl_accounts` | `gl_account_id` |
| `supplier_groups` | `tax_position_id` | `tax_positions` | `tax_position_id` |
| `supplier_groups` | `trading_terms_id` | `trading_terms` | `trading_terms_id` |
| `suppliers` | `supplier_group_id` | `supplier_groups` | `supplier_group_id` |
| `suppliers` | `tax_position_id` | `tax_positions` | `tax_position_id` |
| `suppliers` | `trading_terms_id` | `trading_terms` | `trading_terms_id` |
| `tax_position_mappings` | `destination_tax_category_id` | `tax_categories` | `tax_category_id` |
| `tax_position_mappings` | `source_tax_category_id` | `tax_categories` | `tax_category_id` |
| `tax_position_mappings` | `tax_position_id` | `tax_positions` | `tax_position_id` |
| `transfer_order_lines` | `product_id` | `products` | `product_id` |
| `transfer_order_lines` | `transfer_order_id` | `transfer_orders` | `transfer_order_id` |
| `transfer_order_picks` | `bin_id` | `bins` | `bin_id` |
| `transfer_order_picks` | `product_id` | `products` | `product_id` |
| `transfer_order_picks` | `transfer_order_id` | `transfer_orders` | `transfer_order_id` |
| `transfer_order_picks` | `transfer_order_line_id` | `transfer_order_lines` | `transfer_order_line_id` |
| `transfer_order_receipt_lines` | `bin_id` | `bins` | `bin_id` |
| `transfer_order_receipt_lines` | `product_id` | `products` | `product_id` |
| `transfer_order_receipt_lines` | `receipt_id` | `transfer_order_receipts` | `receipt_id` |
| `transfer_order_receipt_lines` | `transfer_order_line_id` | `transfer_order_lines` | `transfer_order_line_id` |
| `transfer_order_receipts` | `transfer_order_id` | `transfer_orders` | `transfer_order_id` |
| `transfer_order_shipment_lines` | `pick_id` | `transfer_order_picks` | `pick_id` |
| `transfer_order_shipment_lines` | `product_id` | `products` | `product_id` |
| `transfer_order_shipment_lines` | `shipment_id` | `transfer_order_shipments` | `shipment_id` |
| `transfer_order_shipment_lines` | `transfer_order_line_id` | `transfer_order_lines` | `transfer_order_line_id` |
| `transfer_order_shipments` | `transfer_order_id` | `transfer_orders` | `transfer_order_id` |
| `transfer_orders` | `destination_location_id` | `locations` | `location_id` |
| `transfer_orders` | `source_location_id` | `locations` | `location_id` |
| `user_events` | `user_id` | `users` | `user_id` |
| `user_settings` | `user_id` | `users` | `user_id` |
| `zones` | `location_id` | `locations` | `location_id` |

---

## Lineage

```mermaid
graph LR
    _pipeline_jobs["_pipeline_jobs"]
    activities["activities"]
    api_keys["api_keys"]
    app_settings["app_settings"]
    backorders["backorders"]
    bank_statement_lines["bank_statement_lines"]
    bin_contents["bin_contents"]
    bins["bins"]
    business_report_events["business_report_events"]
    business_reports["business_reports"]
    casbin_rule["casbin_rule"]
    cost_centers["cost_centers"]
    csv_mapping_profiles["csv_mapping_profiles"]
    customer_contacts["customer_contacts"]
    customer_delivery_addresses["customer_delivery_addresses"]
    customer_groups["customer_groups"]
    customers["customers"]
    discount_matrix["discount_matrix"]
    email_events["email_events"]
    email_outbox["email_outbox"]
    exchange_rates["exchange_rates"]
    financial_events["financial_events"]
    gl_accounts["gl_accounts"]
    gl_journal_entries["gl_journal_entries"]
    gl_journal_lines["gl_journal_lines"]
    gl_match_groups["gl_match_groups"]
    gl_reconciliations["gl_reconciliations"]
    gl_settings["gl_settings"]
    goods_received["goods_received"]
    goods_received_lines["goods_received_lines"]
    group_events["group_events"]
    import_abm_sales_quotes["import_abm_sales_quotes"]
    integration_events["integration_events"]
    integrations["integrations"]
    inventory_entries["inventory_entries"]
    inventory_events["inventory_events"]
    inventory_ledger["inventory_ledger"]
    locations["locations"]
    macros["macros"]
    master_data_events["master_data_events"]
    organization["organization"]
    outbox["outbox"]
    payment_allocations["payment_allocations"]
    payment_entries["payment_entries"]
    payment_lines["payment_lines"]
    pdf_template_contexts["pdf_template_contexts"]
    pdf_template_hooks["pdf_template_hooks"]
    pdf_templates["pdf_templates"]
    procurement_events["procurement_events"]
    product_components["product_components"]
    product_default_bins["product_default_bins"]
    product_groups["product_groups"]
    product_suppliers["product_suppliers"]
    product_uoms["product_uoms"]
    products["products"]
    purchase_debit_note_lines["purchase_debit_note_lines"]
    purchase_debit_notes["purchase_debit_notes"]
    purchase_invoice_lines["purchase_invoice_lines"]
    purchase_invoice_receipts["purchase_invoice_receipts"]
    purchase_invoices["purchase_invoices"]
    purchase_order_lines["purchase_order_lines"]
    purchase_order_return_lines["purchase_order_return_lines"]
    purchase_order_return_shipment_lines["purchase_order_return_shipment_lines"]
    purchase_order_return_shipments["purchase_order_return_shipments"]
    purchase_order_returns["purchase_order_returns"]
    purchase_orders["purchase_orders"]
    reconciliation_events["reconciliation_events"]
    reconciliation_rules["reconciliation_rules"]
    sales_credit_note_lines["sales_credit_note_lines"]
    sales_credit_notes["sales_credit_notes"]
    sales_events["sales_events"]
    sales_invoice_lines["sales_invoice_lines"]
    sales_invoices["sales_invoices"]
    sales_order_lines["sales_order_lines"]
    sales_order_picks["sales_order_picks"]
    sales_order_return_lines["sales_order_return_lines"]
    sales_order_returns["sales_order_returns"]
    sales_order_shipment_lines["sales_order_shipment_lines"]
    sales_order_shipments["sales_order_shipments"]
    sales_orders["sales_orders"]
    schema_migrations["schema_migrations"]
    supplier_expiries["supplier_expiries"]
    supplier_groups["supplier_groups"]
    suppliers["suppliers"]
    system_events["system_events"]
    tax_categories["tax_categories"]
    tax_position_mappings["tax_position_mappings"]
    tax_positions["tax_positions"]
    trading_terms["trading_terms"]
    transfer_order_lines["transfer_order_lines"]
    transfer_order_picks["transfer_order_picks"]
    transfer_order_receipt_lines["transfer_order_receipt_lines"]
    transfer_order_receipts["transfer_order_receipts"]
    transfer_order_shipment_lines["transfer_order_shipment_lines"]
    transfer_order_shipments["transfer_order_shipments"]
    transfer_orders["transfer_orders"]
    uom_dictionary["uom_dictionary"]
    user_events["user_events"]
    user_settings["user_settings"]
    users["users"]
    warehouse_events["warehouse_events"]
    webhooks["webhooks"]
    zones["zones"]
    tax_positions --> app_settings
    trading_terms --> app_settings
    locations --> app_settings
    tax_categories --> app_settings
    products --> backorders
    purchase_orders --> backorders
    purchase_order_lines --> backorders
    sales_orders --> backorders
    sales_order_lines --> backorders
    transfer_orders --> backorders
    transfer_order_lines --> backorders
    gl_accounts --> bank_statement_lines
    gl_journal_lines --> bank_statement_lines
    gl_reconciliations --> bank_statement_lines
    bins --> bin_contents
    products --> bin_contents
    zones --> bins
    customers --> customer_contacts
    customers --> customer_delivery_addresses
    activities --> customer_groups
    gl_accounts --> customer_groups
    cost_centers --> customer_groups
    tax_positions --> customer_groups
    trading_terms --> customer_groups
    customer_groups --> customers
    tax_positions --> customers
    trading_terms --> customers
    customer_groups --> discount_matrix
    customers --> discount_matrix
    product_groups --> discount_matrix
    activities --> gl_journal_lines
    cost_centers --> gl_journal_lines
    gl_accounts --> gl_journal_lines
    gl_journal_entries --> gl_journal_lines
    gl_reconciliations --> gl_journal_lines
    reconciliation_rules --> gl_match_groups
    gl_accounts --> gl_reconciliations
    activities --> gl_settings
    gl_accounts --> gl_settings
    cost_centers --> gl_settings
    locations --> goods_received
    suppliers --> goods_received
    goods_received --> goods_received_lines
    products --> goods_received_lines
    purchase_orders --> goods_received_lines
    purchase_order_lines --> goods_received_lines
    bins --> inventory_ledger
    inventory_entries --> inventory_ledger
    locations --> inventory_ledger
    products --> inventory_ledger
    zones --> inventory_ledger
    payment_entries --> payment_allocations
    gl_accounts --> payment_entries
    gl_accounts --> payment_lines
    payment_entries --> payment_lines
    pdf_templates --> pdf_template_contexts
    pdf_templates --> pdf_template_hooks
    products --> product_components
    bins --> product_default_bins
    locations --> product_default_bins
    products --> product_default_bins
    activities --> product_groups
    cost_centers --> product_groups
    gl_accounts --> product_groups
    tax_categories --> product_groups
    products --> product_suppliers
    suppliers --> product_suppliers
    products --> product_uoms
    uom_dictionary --> product_uoms
    uom_dictionary --> products
    product_groups --> products
    tax_categories --> products
    purchase_debit_notes --> purchase_debit_note_lines
    purchase_order_lines --> purchase_debit_note_lines
    purchase_orders --> purchase_debit_notes
    purchase_order_returns --> purchase_debit_notes
    suppliers --> purchase_debit_notes
    gl_accounts --> purchase_invoice_lines
    products --> purchase_invoice_lines
    purchase_order_lines --> purchase_invoice_lines
    goods_received_lines --> purchase_invoice_receipts
    purchase_invoice_lines --> purchase_invoice_receipts
    products --> purchase_order_lines
    purchase_orders --> purchase_order_lines
    tax_categories --> purchase_order_lines
    purchase_order_lines --> purchase_order_return_lines
    purchase_order_returns --> purchase_order_return_lines
    purchase_order_return_lines --> purchase_order_return_shipment_lines
    purchase_order_return_shipments --> purchase_order_return_shipment_lines
    locations --> purchase_order_return_shipments
    purchase_order_returns --> purchase_order_return_shipments
    purchase_orders --> purchase_order_returns
    locations --> purchase_orders
    suppliers --> purchase_orders
    activities --> reconciliation_rules
    cost_centers --> reconciliation_rules
    gl_accounts --> reconciliation_rules
    gl_accounts --> sales_credit_note_lines
    sales_credit_notes --> sales_credit_note_lines
    sales_order_lines --> sales_credit_note_lines
    tax_categories --> sales_credit_note_lines
    customers --> sales_credit_notes
    sales_order_returns --> sales_credit_notes
    sales_orders --> sales_credit_notes
    sales_order_lines --> sales_invoice_lines
    locations --> sales_order_lines
    sales_order_lines --> sales_order_lines
    products --> sales_order_lines
    sales_orders --> sales_order_lines
    tax_categories --> sales_order_lines
    bins --> sales_order_picks
    products --> sales_order_picks
    sales_orders --> sales_order_picks
    sales_order_lines --> sales_order_picks
    sales_order_returns --> sales_order_return_lines
    sales_order_lines --> sales_order_return_lines
    sales_orders --> sales_order_returns
    sales_order_lines --> sales_order_shipment_lines
    sales_order_shipments --> sales_order_shipment_lines
    locations --> sales_order_shipments
    sales_orders --> sales_order_shipments
    customers --> sales_orders
    locations --> sales_orders
    suppliers --> supplier_expiries
    activities --> supplier_groups
    gl_accounts --> supplier_groups
    cost_centers --> supplier_groups
    tax_positions --> supplier_groups
    trading_terms --> supplier_groups
    supplier_groups --> suppliers
    tax_positions --> suppliers
    trading_terms --> suppliers
    tax_categories --> tax_position_mappings
    tax_positions --> tax_position_mappings
    products --> transfer_order_lines
    transfer_orders --> transfer_order_lines
    bins --> transfer_order_picks
    products --> transfer_order_picks
    transfer_orders --> transfer_order_picks
    transfer_order_lines --> transfer_order_picks
    bins --> transfer_order_receipt_lines
    products --> transfer_order_receipt_lines
    transfer_order_receipts --> transfer_order_receipt_lines
    transfer_order_lines --> transfer_order_receipt_lines
    transfer_orders --> transfer_order_receipts
    transfer_order_picks --> transfer_order_shipment_lines
    products --> transfer_order_shipment_lines
    transfer_order_shipments --> transfer_order_shipment_lines
    transfer_order_lines --> transfer_order_shipment_lines
    transfer_orders --> transfer_order_shipments
    locations --> transfer_orders
    users --> user_events
    users --> user_settings
    locations --> zones
```

---

### `herobm_core._pipeline_jobs` (25 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `job_id` | `text` |  |  | 🔑 PK |
| 2 | `type` | `text` |  |  |  |
| 3 | `status` | `text` |  |  |  |
| 4 | `progress_json` | `jsonb` | ✓ | '[]'::jsonb |  |
| 5 | `logs_json` | `jsonb` | ✓ | '[]'::jsonb |  |
| 6 | `created_at` | `timestamp` |  | now() |  |
| 7 | `updated_at` | `timestamp` |  | now() |  |

### `herobm_core.activities` (76 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `activity_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `code` | `text` |  |  | UNIQUE |
| 3 | `name` | `text` |  |  |  |
| 4 | `is_system` | `bool` |  | false |  |
| 5 | `is_active` | `bool` |  | true |  |
| 6 | `created_on` | `timestamptz` | ✓ | now() |  |
| 7 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.api_keys` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `api_key_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `name` | `text` |  |  |  |
| 3 | `key_hash` | `text` |  |  |  |
| 4 | `prefix` | `text` |  |  |  |
| 5 | `is_active` | `bool` |  | true |  |
| 6 | `created_by` | `text` |  |  |  |
| 7 | `created_on` | `timestamptz` | ✓ | now() |  |
| 8 | `role` | `text` |  |  |  |

### `herobm_core.app_settings` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `settings_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `default_fulfillment_location_id` | `uuid` | ✓ |  | FK → locations.location_id |
| 3 | `inventory_valuation_method` | `text` |  | 'weighted_average'::text |  |
| 4 | `inventory_accounting_mode` | `text` |  | 'periodic'::text |  |
| 5 | `credit_limit_behavior` | `text` |  | 'soft'::text |  |
| 6 | `api_rate_limit` | `numeric` |  | '1000'::numeric |  |
| 7 | `setup_completed_at` | `timestamptz` | ✓ |  |  |
| 8 | `tax_provider_mappings` | `jsonb` | ✓ |  |  |
| 9 | `enrichment_provider_mappings` | `jsonb` | ✓ |  |  |
| 10 | `system_identifier` | `text` | ✓ |  |  |
| 11 | `active_license_key` | `text` | ✓ |  |  |
| 12 | `active_license_payload` | `jsonb` | ✓ |  |  |
| 13 | `smtp_host` | `text` | ✓ |  |  |
| 14 | `smtp_port` | `int4` | ✓ |  |  |
| 15 | `smtp_user` | `text` | ✓ |  |  |
| 16 | `smtp_pass_encrypted` | `text` | ✓ |  |  |
| 17 | `smtp_from_address` | `text` | ✓ |  |  |
| 18 | `default_purchase_tax_category_id` | `uuid` | ✓ |  | FK → tax_categories.tax_category_id |
| 19 | `default_sales_tax_category_id` | `uuid` | ✓ |  | FK → tax_categories.tax_category_id |
| 20 | `default_customer_terms_id` | `uuid` | ✓ |  | FK → trading_terms.trading_terms_id |
| 21 | `default_supplier_terms_id` | `uuid` | ✓ |  | FK → trading_terms.trading_terms_id |
| 22 | `default_customer_tax_position_id` | `uuid` | ✓ |  | FK → tax_positions.tax_position_id |
| 23 | `default_supplier_tax_position_id` | `uuid` | ✓ |  | FK → tax_positions.tax_position_id |

### `herobm_core.backorders` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `backorder_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `sales_order_id` | `uuid` |  |  | FK → sales_orders.sales_order_id |
| 3 | `sales_order_line_id` | `uuid` |  |  | FK → sales_order_lines.sales_order_line_id |
| 4 | `product_id` | `uuid` |  |  | FK → products.product_id |
| 5 | `purchase_order_id` | `uuid` | ✓ |  | FK → purchase_orders.purchase_order_id |
| 6 | `purchase_order_line_id` | `uuid` | ✓ |  | FK → purchase_order_lines.purchase_order_line_id |
| 7 | `transfer_order_id` | `uuid` | ✓ |  | FK → transfer_orders.transfer_order_id |
| 8 | `transfer_order_line_id` | `uuid` | ✓ |  | FK → transfer_order_lines.transfer_order_line_id |
| 9 | `quantity` | `numeric` |  |  |  |
| 10 | `state_code` | `text` |  | 'pending_supply'::text |  |
| 11 | `created_on` | `timestamptz` | ✓ | now() |  |
| 12 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.bank_statement_lines` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `line_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `gl_account_id` | `uuid` |  |  | FK → gl_accounts.gl_account_id |
| 3 | `date` | `date` |  |  |  |
| 4 | `description` | `text` |  |  |  |
| 5 | `amount` | `numeric` |  |  |  |
| 6 | `reference` | `text` | ✓ |  |  |
| 7 | `is_reconciled` | `bool` |  | false |  |
| 8 | `reconciliation_id` | `uuid` | ✓ |  | FK → gl_reconciliations.reconciliation_id |
| 9 | `matched_journal_line_id` | `uuid` | ✓ |  | FK → gl_journal_lines.journal_line_id |
| 10 | `created_on` | `timestamptz` | ✓ | now() |  |
| 11 | `match_group_id` | `uuid` | ✓ |  |  |
| 12 | `type` | `text` | ✓ |  |  |
| 13 | `payee` | `text` | ✓ |  |  |

### `herobm_core.bin_contents` (12,623 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `bin_content_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `bin_id` | `uuid` |  |  | FK → bins.bin_id, UNIQUE, UNIQUE |
| 3 | `product_id` | `uuid` |  |  | FK → products.product_id, UNIQUE, UNIQUE |
| 4 | `actual_quantity` | `numeric` |  | '0'::numeric |  |
| 5 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.bins` (12,656 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `bin_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `bin_number` | `text` |  |  | UNIQUE, UNIQUE |
| 3 | `zone_id` | `uuid` |  |  | FK → zones.zone_id, UNIQUE, UNIQUE |
| 4 | `bin_type` | `bin_type_enum` |  |  |  |
| 5 | `is_consignment` | `bool` | ✓ | false |  |
| 6 | `is_bonded` | `bool` | ✓ | false |  |
| 7 | `is_unavailable` | `bool` | ✓ | false |  |
| 8 | `source_id` | `text` | ✓ |  | UNIQUE |
| 9 | `source` | `text` |  | 'app'::text |  |
| 10 | `created_by` | `text` | ✓ |  |  |
| 11 | `created_on` | `timestamptz` | ✓ | now() |  |
| 12 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.business_report_events` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `event_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `entity_type` | `text` |  |  |  |
| 3 | `entity_id` | `uuid` |  |  |  |
| 4 | `event_type` | `text` |  |  |  |
| 5 | `entity_display_name` | `text` | ✓ |  |  |
| 6 | `payload` | `jsonb` | ✓ |  |  |
| 7 | `actor` | `text` | ✓ |  |  |
| 8 | `created_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.business_reports` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `slug` | `text` |  |  | UNIQUE |
| 3 | `name` | `text` |  |  |  |
| 4 | `description` | `text` | ✓ |  |  |
| 5 | `data_source_hook` | `text` |  |  |  |
| 6 | `ui_config` | `jsonb` |  | '{}'::jsonb |  |
| 7 | `is_system` | `bool` |  | false |  |
| 8 | `created_at` | `timestamptz` |  | now() |  |

### `herobm_core.casbin_rule` (161 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `ptype` | `text` |  |  |  |
| 3 | `v0` | `text` | ✓ |  |  |
| 4 | `v1` | `text` | ✓ |  |  |
| 5 | `v2` | `text` | ✓ |  |  |
| 6 | `v3` | `text` | ✓ |  |  |
| 7 | `v4` | `text` | ✓ |  |  |
| 8 | `v5` | `text` | ✓ |  |  |

### `herobm_core.cost_centers` (37 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `cost_center_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `code` | `text` |  |  | UNIQUE |
| 3 | `name` | `text` |  |  |  |
| 4 | `is_system` | `bool` |  | false |  |
| 5 | `is_active` | `bool` |  | true |  |
| 6 | `created_on` | `timestamptz` | ✓ | now() |  |
| 7 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.csv_mapping_profiles` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `profile_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `name` | `text` |  |  |  |
| 3 | `date_column` | `text` |  |  |  |
| 4 | `amount_column` | `text` | ✓ |  |  |
| 5 | `description_column` | `text` |  |  |  |
| 6 | `reference_column` | `text` | ✓ |  |  |
| 7 | `header_rows` | `int4` |  | 1 |  |
| 8 | `created_on` | `timestamptz` | ✓ | now() |  |
| 9 | `debit_column` | `text` | ✓ |  |  |
| 10 | `credit_column` | `text` | ✓ |  |  |
| 11 | `type_column` | `text` | ✓ |  |  |
| 12 | `payee_column` | `text` | ✓ |  |  |

### `herobm_core.customer_contacts` (3,364 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `customer_id` | `uuid` |  |  | FK → customers.customer_id |
| 3 | `first_name` | `text` | ✓ |  |  |
| 4 | `last_name` | `text` | ✓ |  |  |
| 5 | `full_name` | `text` | ✓ |  |  |
| 6 | `email` | `text` | ✓ |  |  |
| 7 | `email_secondary` | `text` | ✓ |  |  |
| 8 | `phone` | `text` | ✓ |  |  |
| 9 | `mobile` | `text` | ✓ |  |  |
| 10 | `job_title` | `text` | ✓ |  |  |
| 11 | `is_primary` | `bool` |  | false |  |
| 12 | `source_id` | `text` | ✓ |  |  |
| 13 | `source` | `text` |  | 'app'::text |  |
| 14 | `created_on` | `timestamptz` | ✓ | now() |  |
| 15 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.customer_delivery_addresses` (2,095 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `customer_id` | `uuid` |  |  | FK → customers.customer_id |
| 3 | `address_name` | `text` | ✓ |  |  |
| 4 | `address_line1` | `text` | ✓ |  |  |
| 5 | `address_line2` | `text` | ✓ |  |  |
| 6 | `city` | `text` | ✓ |  |  |
| 7 | `state_or_province` | `text` | ✓ |  |  |
| 8 | `postal_code` | `text` | ✓ |  |  |
| 9 | `country` | `text` | ✓ |  |  |
| 10 | `is_primary` | `bool` |  | false |  |
| 11 | `source_id` | `text` | ✓ |  |  |
| 12 | `source` | `text` |  | 'app'::text |  |
| 13 | `created_on` | `timestamptz` | ✓ | now() |  |
| 14 | `modified_on` | `timestamptz` | ✓ | now() |  |
| 15 | `recipient_name` | `text` | ✓ |  |  |
| 16 | `recipient_phone` | `text` | ✓ |  |  |

### `herobm_core.customer_groups` (14 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `customer_group_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `group_code` | `text` |  |  | UNIQUE |
| 3 | `name` | `text` |  |  |  |
| 4 | `default_ar_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 5 | `default_revenue_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 6 | `trading_terms_id` | `uuid` | ✓ |  | FK → trading_terms.trading_terms_id |
| 7 | `default_cost_center_id` | `uuid` | ✓ |  | FK → cost_centers.cost_center_id |
| 8 | `default_activity_id` | `uuid` | ✓ |  | FK → activities.activity_id |
| 9 | `credit_limit` | `numeric` | ✓ | '0'::numeric |  |
| 10 | `is_on_credit_hold` | `bool` |  | false |  |
| 11 | `tax_position_id` | `uuid` | ✓ |  | FK → tax_positions.tax_position_id |
| 12 | `state_code` | `text` |  | 'active'::text |  |
| 13 | `early_payment_discount` | `numeric` | ✓ | '0'::numeric |  |
| 14 | `early_payment_discount_days` | `int4` | ✓ |  |  |

### `herobm_core.customers` (1,435 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `customer_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `customer_number` | `text` |  |  | UNIQUE |
| 3 | `name` | `text` |  |  |  |
| 4 | `billing_address_line1` | `text` | ✓ |  |  |
| 5 | `billing_address_line2` | `text` | ✓ |  |  |
| 6 | `billing_address_city` | `text` | ✓ |  |  |
| 7 | `billing_address_state_or_province` | `text` | ✓ |  |  |
| 8 | `billing_address_postal_code` | `text` | ✓ |  |  |
| 9 | `billing_address_country` | `text` |  |  |  |
| 10 | `telephone1` | `text` | ✓ |  |  |
| 11 | `fax` | `text` | ✓ |  |  |
| 12 | `email_address1` | `text` | ✓ |  |  |
| 13 | `customer_group_id` | `uuid` | ✓ |  | FK → customer_groups.customer_group_id |
| 14 | `state_code` | `text` |  | 'active'::text |  |
| 15 | `currency_code` | `text` |  |  |  |
| 16 | `trading_terms_id` | `uuid` | ✓ |  | FK → trading_terms.trading_terms_id |
| 17 | `credit_limit` | `numeric` | ✓ |  |  |
| 18 | `is_on_credit_hold` | `bool` | ✓ |  |  |
| 19 | `bank_account_name` | `text` | ✓ |  |  |
| 20 | `bank_bsb` | `text` | ✓ |  |  |
| 21 | `bank_account_number` | `text` | ✓ |  |  |
| 22 | `external_id` | `text` | ✓ |  |  |
| 23 | `source_id` | `text` | ✓ |  | UNIQUE |
| 24 | `source` | `text` |  | 'app'::text |  |
| 25 | `price_tier` | `text` | ✓ |  |  |
| 26 | `notes` | `text` | ✓ |  |  |
| 27 | `created_by` | `text` | ✓ |  |  |
| 28 | `created_on` | `timestamptz` | ✓ | now() |  |
| 29 | `modified_on` | `timestamptz` | ✓ | now() |  |
| 30 | `business_number` | `text` | ✓ |  |  |
| 31 | `is_tax_registered` | `bool` |  | false |  |
| 32 | `tax_position_id` | `uuid` | ✓ |  | FK → tax_positions.tax_position_id |
| 33 | `override_credit_hold_until` | `timestamptz` | ✓ |  |  |
| 34 | `early_payment_discount` | `numeric` | ✓ |  |  |
| 35 | `early_payment_discount_days` | `int4` | ✓ |  |  |

### `herobm_core.discount_matrix` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `discount_matrix_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `customer_group_id` | `uuid` | ✓ |  | FK → customer_groups.customer_group_id, UNIQUE, UNIQUE |
| 3 | `customer_id` | `uuid` | ✓ |  | FK → customers.customer_id, UNIQUE, UNIQUE |
| 4 | `product_group_id` | `uuid` | ✓ |  | FK → product_groups.product_group_id, UNIQUE, UNIQUE, UNIQUE, UNIQUE |
| 5 | `discount_percentage` | `numeric` |  | '0'::numeric |  |
| 6 | `created_on` | `timestamptz` | ✓ | now() |  |
| 7 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.email_events` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `event_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `entity_type` | `text` |  |  |  |
| 3 | `entity_id` | `uuid` |  |  |  |
| 4 | `event_type` | `text` |  |  |  |
| 5 | `entity_display_name` | `text` | ✓ |  |  |
| 6 | `payload` | `jsonb` | ✓ |  |  |
| 7 | `actor` | `text` | ✓ |  |  |
| 8 | `created_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.email_outbox` (8 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `to_address` | `text` |  |  |  |
| 3 | `reply_to` | `text` | ✓ |  |  |
| 4 | `subject` | `text` |  |  |  |
| 5 | `html_body` | `text` |  |  |  |
| 6 | `attachments` | `jsonb` | ✓ | '[]'::jsonb |  |
| 7 | `status` | `email_status` |  | 'pending'::herobm_core.email_status |  |
| 8 | `retries` | `int4` |  | 0 |  |
| 9 | `last_error` | `text` | ✓ |  |  |
| 10 | `next_retry_at` | `timestamptz` | ✓ |  |  |
| 11 | `created_at` | `timestamptz` |  | now() |  |
| 12 | `processed_at` | `timestamptz` | ✓ |  |  |
| 13 | `entity_type` | `text` | ✓ |  |  |
| 14 | `entity_id` | `uuid` | ✓ |  |  |

### `herobm_core.exchange_rates` (10 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `exchange_rate_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `currency_code` | `text` |  |  | UNIQUE, UNIQUE |
| 3 | `currency_name` | `text` |  |  |  |
| 4 | `buy_rate` | `numeric` |  |  |  |
| 5 | `sell_rate` | `numeric` |  |  |  |
| 6 | `effective_date` | `timestamp` | ✓ | now() | UNIQUE, UNIQUE |
| 7 | `updated_on` | `timestamp` | ✓ | now() |  |

### `herobm_core.financial_events` (20 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `event_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `entity_type` | `text` |  |  |  |
| 3 | `entity_id` | `uuid` |  |  |  |
| 4 | `event_type` | `text` |  |  |  |
| 5 | `payload` | `jsonb` | ✓ |  |  |
| 6 | `actor` | `text` | ✓ |  |  |
| 7 | `created_on` | `timestamptz` | ✓ | now() |  |
| 8 | `entity_display_name` | `text` | ✓ |  |  |

### `herobm_core.gl_accounts` (119 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `gl_account_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `account_code` | `text` |  |  | UNIQUE |
| 3 | `name` | `text` |  |  |  |
| 4 | `account_type` | `text` |  |  |  |
| 5 | `parent_account_id` | `uuid` | ✓ |  |  |
| 6 | `is_group` | `bool` |  | false |  |
| 7 | `is_system` | `bool` |  | false |  |
| 8 | `is_bank_account` | `bool` |  | false |  |
| 9 | `currency_code` | `text` |  |  |  |
| 10 | `metadata` | `jsonb` | ✓ | '{}'::jsonb |  |
| 11 | `is_active` | `bool` |  | true |  |
| 12 | `created_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.gl_journal_entries` (7 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `journal_entry_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `entry_number` | `text` |  |  | UNIQUE |
| 3 | `entry_date` | `date` |  |  |  |
| 4 | `memo` | `text` | ✓ |  |  |
| 5 | `source_type` | `text` |  |  |  |
| 6 | `source_id` | `uuid` | ✓ |  |  |
| 7 | `is_reversed` | `bool` |  | false |  |
| 8 | `reversed_by` | `uuid` | ✓ |  |  |
| 9 | `created_by` | `text` | ✓ |  |  |
| 10 | `created_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.gl_journal_lines` (166 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `journal_line_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `journal_entry_id` | `uuid` |  |  | FK → gl_journal_entries.journal_entry_id |
| 3 | `gl_account_id` | `uuid` |  |  | FK → gl_accounts.gl_account_id |
| 4 | `party_type` | `text` | ✓ |  |  |
| 5 | `party_id` | `text` | ✓ |  |  |
| 6 | `debit` | `numeric` |  | '0'::numeric |  |
| 7 | `credit` | `numeric` |  | '0'::numeric |  |
| 8 | `memo` | `text` | ✓ |  |  |
| 9 | `is_reconciled` | `bool` |  | false |  |
| 10 | `reconciliation_id` | `uuid` | ✓ |  | FK → gl_reconciliations.reconciliation_id |
| 11 | `cost_center_id` | `uuid` | ✓ |  | FK → cost_centers.cost_center_id |
| 12 | `activity_id` | `uuid` | ✓ |  | FK → activities.activity_id |
| 13 | `match_group_id` | `uuid` | ✓ |  |  |
| 14 | `foreign_debit` | `numeric` |  | '0'::numeric |  |
| 15 | `foreign_credit` | `numeric` |  | '0'::numeric |  |
| 16 | `foreign_currency_code` | `text` | ✓ |  |  |
| 17 | `exchange_rate` | `numeric` | ✓ | '1'::numeric |  |

### `herobm_core.gl_match_groups` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `match_group_id` | `uuid` |  |  | 🔑 PK |
| 2 | `match_type` | `text` |  |  |  |
| 3 | `rule_id` | `uuid` | ✓ |  | FK → reconciliation_rules.rule_id |
| 4 | `created_by` | `text` |  |  |  |
| 5 | `created_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.gl_reconciliations` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `reconciliation_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `gl_account_id` | `uuid` |  |  | FK → gl_accounts.gl_account_id |
| 3 | `statement_date` | `date` |  |  |  |
| 4 | `statement_balance` | `numeric` |  |  |  |
| 5 | `status` | `text` |  | 'draft'::text |  |
| 6 | `created_by` | `text` | ✓ |  |  |
| 7 | `created_on` | `timestamptz` | ✓ | now() |  |
| 8 | `posted_on` | `timestamptz` | ✓ |  |  |

### `herobm_core.gl_settings` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `settings_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `account_metadata_schema` | `jsonb` | ✓ | '[]'::jsonb |  |
| 3 | `fiscal_year_start_month` | `int4` |  |  |  |
| 4 | `default_ar_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 5 | `default_ap_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 6 | `default_revenue_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 7 | `default_cogs_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 8 | `default_tax_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 9 | `default_expense_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 10 | `default_inventory_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 11 | `default_grni_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 12 | `default_shrinkage_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 13 | `base_currency` | `text` |  |  |  |
| 14 | `revenue_routing_precedence` | `text` |  | 'product_first'::text |  |
| 15 | `expense_routing_precedence` | `text` |  | 'product_first'::text |  |
| 16 | `default_fee_revenue_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 17 | `supported_batch_payment_formats` | `jsonb` | ✓ | '[]'::jsonb |  |
| 18 | `bank_match_date_tolerance_days` | `int4` |  | 3 |  |
| 19 | `default_discounts_received_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 20 | `default_cost_center_id` | `uuid` | ✓ |  | FK → cost_centers.cost_center_id |
| 21 | `default_activity_id` | `uuid` | ✓ |  | FK → activities.activity_id |
| 22 | `default_ppv_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 23 | `default_discounts_given_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 24 | `realised_fx_gain_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 25 | `realised_fx_loss_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 26 | `unrealised_fx_gain_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 27 | `unrealised_fx_loss_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |

### `herobm_core.goods_received` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `goods_received_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `receipt_number` | `text` |  |  | UNIQUE |
| 3 | `vendor_id` | `uuid` |  |  | FK → suppliers.vendor_id |
| 4 | `location_id` | `uuid` |  |  | FK → locations.location_id |
| 5 | `packing_slip_number` | `text` | ✓ |  |  |
| 6 | `notes` | `text` | ✓ |  |  |
| 7 | `state_code` | `text` |  | 'received'::text |  |
| 8 | `created_by` | `text` | ✓ |  |  |
| 9 | `created_on` | `timestamptz` | ✓ | now() |  |
| 10 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.goods_received_lines` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `goods_received_line_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `goods_received_id` | `uuid` |  |  | FK → goods_received.goods_received_id |
| 3 | `product_id` | `uuid` |  |  | FK → products.product_id |
| 4 | `quantity_received` | `numeric` |  |  |  |
| 5 | `match_status` | `text` |  | 'unmatched'::text |  |
| 6 | `putaway_status` | `text` |  | 'pending_putaway'::text |  |
| 7 | `purchase_order_line_id` | `uuid` | ✓ |  | FK → purchase_order_lines.purchase_order_line_id |
| 8 | `purchase_order_id` | `uuid` | ✓ |  | FK → purchase_orders.purchase_order_id |
| 9 | `unit_cost` | `numeric` | ✓ |  |  |

### `herobm_core.group_events` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `event_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `entity_type` | `text` |  |  |  |
| 3 | `entity_id` | `uuid` |  |  |  |
| 4 | `event_type` | `text` |  |  |  |
| 5 | `entity_display_name` | `text` | ✓ |  |  |
| 6 | `payload` | `jsonb` | ✓ |  |  |
| 7 | `actor` | `text` | ✓ |  |  |
| 8 | `created_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.import_abm_sales_quotes` (8,740 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `sales_order_id` | `text` | ✓ |  |  |
| 2 | `customer_id` | `uuid` | ✓ |  |  |
| 3 | `currency_code` | `text` | ✓ |  |  |
| 4 | `issue_date` | `timestamptz` | ✓ |  |  |
| 5 | `quote_number` | `text` | ✓ |  |  |
| 6 | `state_code` | `text` | ✓ |  |  |
| 7 | `delivery_address_line1` | `text` | ✓ |  |  |
| 8 | `delivery_address_line2` | `text` | ✓ |  |  |
| 9 | `delivery_city` | `text` | ✓ |  |  |
| 10 | `delivery_state` | `text` | ✓ |  |  |
| 11 | `delivery_postal_code` | `text` | ✓ |  |  |
| 12 | `delivery_country` | `text` | ✓ |  |  |
| 13 | `delivery_name` | `text` | ✓ |  |  |
| 14 | `fulfillment_location_id` | `uuid` | ✓ |  |  |
| 15 | `source` | `text` | ✓ |  |  |
| 16 | `source_id` | `text` | ✓ |  |  |
| 17 | `created_by` | `text` | ✓ |  |  |

### `herobm_core.integration_events` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `event_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `entity_type` | `text` |  |  |  |
| 3 | `entity_id` | `uuid` |  |  |  |
| 4 | `event_type` | `text` |  |  |  |
| 5 | `entity_display_name` | `text` | ✓ |  |  |
| 6 | `payload` | `jsonb` | ✓ |  |  |
| 7 | `actor` | `text` | ✓ |  |  |
| 8 | `created_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.integrations` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `integration_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `provider` | `text` |  |  | UNIQUE |
| 3 | `config` | `jsonb` |  | '{}'::jsonb |  |
| 4 | `is_active` | `bool` |  | true |  |
| 5 | `created_on` | `timestamptz` | ✓ | now() |  |
| 6 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.inventory_entries` (12,003 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `entry_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `entry_number` | `text` |  |  | UNIQUE |
| 3 | `entry_date` | `timestamptz` |  | now() |  |
| 4 | `memo` | `text` | ✓ |  |  |
| 5 | `source_type` | `text` |  |  |  |
| 6 | `source_id` | `uuid` | ✓ |  |  |
| 7 | `is_reversed` | `bool` |  | false |  |
| 8 | `reversed_by` | `uuid` | ✓ |  |  |
| 9 | `created_by` | `text` | ✓ |  |  |
| 10 | `created_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.inventory_events` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `event_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `entity_type` | `text` |  |  |  |
| 3 | `entity_id` | `uuid` |  |  |  |
| 4 | `event_type` | `text` |  |  |  |
| 5 | `payload` | `jsonb` | ✓ |  |  |
| 6 | `actor` | `text` | ✓ |  |  |
| 7 | `created_on` | `timestamptz` | ✓ | now() |  |
| 8 | `entity_display_name` | `text` | ✓ |  |  |

### `herobm_core.inventory_ledger` (11,483 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `ledger_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `entry_id` | `uuid` |  |  | FK → inventory_entries.entry_id |
| 3 | `product_id` | `uuid` |  |  | FK → products.product_id |
| 4 | `bin_id` | `uuid` |  |  | FK → bins.bin_id |
| 5 | `location_id` | `uuid` |  |  | FK → locations.location_id |
| 6 | `zone_id` | `uuid` |  |  | FK → zones.zone_id |
| 7 | `quantity` | `numeric` |  |  |  |

### `herobm_core.locations` (11 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `location_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `code` | `text` |  |  | UNIQUE |
| 3 | `name` | `text` |  |  |  |
| 4 | `address_line_1` | `text` | ✓ |  |  |
| 5 | `city` | `text` | ✓ |  |  |
| 6 | `state` | `text` | ✓ |  |  |
| 7 | `country` | `text` | ✓ |  |  |
| 8 | `post_code` | `text` | ✓ |  |  |
| 9 | `source_id` | `text` | ✓ |  | UNIQUE |
| 10 | `source` | `text` |  | 'app'::text |  |
| 11 | `created_by` | `text` | ✓ |  |  |
| 12 | `created_on` | `timestamptz` | ✓ | now() |  |
| 13 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.macros` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `macro_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `name` | `text` |  |  | UNIQUE |
| 3 | `macro_type` | `text` |  |  |  |
| 4 | `content` | `text` |  |  |  |
| 5 | `created_on` | `timestamptz` | ✓ | now() |  |
| 6 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.master_data_events` (153 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `event_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `entity_type` | `text` |  |  |  |
| 3 | `entity_id` | `uuid` |  |  |  |
| 4 | `event_type` | `text` |  |  |  |
| 5 | `payload` | `jsonb` | ✓ |  |  |
| 6 | `actor` | `text` | ✓ |  |  |
| 7 | `created_on` | `timestamptz` | ✓ | now() |  |
| 8 | `entity_display_name` | `text` | ✓ |  |  |

### `herobm_core.organization` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `organization_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `name` | `text` |  |  |  |
| 3 | `address_line_1` | `text` | ✓ |  |  |
| 4 | `address_line_2` | `text` | ✓ |  |  |
| 5 | `city` | `text` | ✓ |  |  |
| 6 | `state` | `text` | ✓ |  |  |
| 7 | `country` | `text` | ✓ |  |  |
| 8 | `post_code` | `text` | ✓ |  |  |
| 9 | `email` | `text` | ✓ |  |  |
| 10 | `phone` | `text` | ✓ |  |  |
| 11 | `website` | `text` | ✓ |  |  |
| 12 | `company_number` | `text` | ✓ |  |  |
| 13 | `tax_number` | `text` | ✓ |  |  |
| 14 | `logo_url` | `text` | ✓ |  |  |
| 15 | `bank_name` | `text` | ✓ |  |  |
| 16 | `bank_account_name` | `text` | ✓ |  |  |
| 17 | `bank_account_number` | `text` | ✓ |  |  |
| 18 | `bank_swift_bic` | `text` | ✓ |  |  |
| 19 | `bank_iban` | `text` | ✓ |  |  |

### `herobm_core.outbox` (97 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `outbox_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `entity_type` | `text` |  |  |  |
| 3 | `entity_id` | `uuid` |  |  |  |
| 4 | `event_type` | `text` |  |  |  |
| 5 | `payload` | `jsonb` | ✓ |  |  |
| 6 | `created_on` | `timestamptz` | ✓ | now() |  |
| 7 | `processed_at` | `timestamptz` | ✓ |  |  |
| 8 | `locked_until` | `timestamptz` | ✓ |  |  |
| 9 | `last_error` | `text` | ✓ |  |  |
| 10 | `entity_display_name` | `text` | ✓ |  |  |

### `herobm_core.payment_allocations` (2 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `allocation_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `payment_id` | `uuid` |  |  | FK → payment_entries.payment_id |
| 3 | `reference_type` | `text` |  |  |  |
| 4 | `reference_id` | `uuid` |  |  |  |
| 5 | `allocated_amount` | `numeric` |  |  |  |
| 6 | `created_on` | `timestamptz` | ✓ | now() |  |
| 7 | `discount_amount` | `numeric` | ✓ | '0'::numeric |  |

### `herobm_core.payment_entries` (2 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `payment_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `payment_number` | `text` |  |  | UNIQUE |
| 3 | `payment_type` | `text` |  |  |  |
| 4 | `party_id` | `uuid` | ✓ |  |  |
| 5 | `payment_date` | `timestamptz` |  |  |  |
| 6 | `mode_of_payment` | `text` |  |  |  |
| 7 | `total_amount` | `numeric` |  |  |  |
| 8 | `unallocated_amount` | `numeric` |  |  |  |
| 9 | `gl_account_bank` | `uuid` |  |  | FK → gl_accounts.gl_account_id |
| 10 | `reference_number` | `text` | ✓ |  |  |
| 11 | `state_code` | `text` |  | 'draft'::text |  |
| 12 | `currency_code` | `text` |  |  |  |
| 13 | `created_by` | `text` | ✓ |  |  |
| 14 | `aba_exported_at` | `timestamptz` | ✓ |  |  |
| 15 | `created_on` | `timestamptz` | ✓ | now() |  |
| 16 | `modified_on` | `timestamptz` | ✓ | now() |  |
| 17 | `base_total_amount` | `numeric` | ✓ | '0'::numeric |  |
| 18 | `base_unallocated_amount` | `numeric` | ✓ | '0'::numeric |  |
| 19 | `exchange_rate` | `numeric` |  | '1'::numeric |  |

### `herobm_core.payment_lines` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `payment_line_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `payment_id` | `uuid` |  |  | FK → payment_entries.payment_id |
| 3 | `gl_account_id` | `uuid` |  |  | FK → gl_accounts.gl_account_id |
| 4 | `amount` | `numeric` |  |  |  |
| 5 | `memo` | `text` | ✓ |  |  |

### `herobm_core.pdf_template_contexts` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `template_id` | `uuid` |  |  | FK → pdf_templates.id, 🔑 PK, 🔑 PK |
| 2 | `context` | `text` |  |  | 🔑 PK, 🔑 PK |

### `herobm_core.pdf_template_hooks` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `hook_slug` | `text` |  |  | UNIQUE |
| 2 | `report_id` | `uuid` |  |  | FK → pdf_templates.id |
| 3 | `context_slug` | `text` |  |  |  |
| 4 | `updated_at` | `timestamptz` |  | now() |  |
| 5 | `id` | `uuid` |  | gen_random_uuid() | 🔑 PK |

### `herobm_core.pdf_templates` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `slug` | `text` |  |  | UNIQUE |
| 3 | `name` | `text` |  |  |  |
| 4 | `template` | `text` |  |  |  |
| 5 | `mock_data` | `jsonb` | ✓ |  |  |
| 6 | `output_name_pattern` | `text` | ✓ | 'Report.pdf'::text |  |
| 7 | `created_at` | `timestamptz` |  | now() |  |
| 8 | `description` | `text` | ✓ |  |  |
| 9 | `context_resolver` | `text` | ✓ |  |  |

### `herobm_core.procurement_events` (54 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `event_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `entity_type` | `text` |  |  |  |
| 3 | `entity_id` | `uuid` |  |  |  |
| 4 | `event_type` | `text` |  |  |  |
| 5 | `payload` | `jsonb` | ✓ |  |  |
| 6 | `actor` | `text` | ✓ |  |  |
| 7 | `created_on` | `timestamptz` | ✓ | now() |  |
| 8 | `entity_display_name` | `text` | ✓ |  |  |

### `herobm_core.product_components` (12,435 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `component_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `parent_product_id` | `uuid` |  |  | FK → products.product_id |
| 3 | `child_product_id` | `uuid` |  |  | FK → products.product_id |
| 4 | `parent_quantity` | `numeric` |  | '1'::numeric |  |
| 5 | `quantity` | `numeric` |  |  |  |
| 6 | `sequence_number` | `int4` | ✓ | 0 |  |
| 7 | `fractional_behavior` | `fractional_behavior` |  | 'allow_fractional'::herobm_core.fract... |  |

### `herobm_core.product_default_bins` (12,796 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `product_default_bin_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `product_id` | `uuid` |  |  | FK → products.product_id, UNIQUE, UNIQUE, UNIQUE |
| 3 | `location_id` | `uuid` |  |  | FK → locations.location_id, UNIQUE, UNIQUE, UNIQUE |
| 4 | `bin_id` | `uuid` |  |  | FK → bins.bin_id, UNIQUE, UNIQUE, UNIQUE |
| 5 | `is_primary_per_loc` | `bool` |  | true |  |
| 6 | `min_quantity` | `numeric` | ✓ | '0'::numeric |  |
| 7 | `max_quantity` | `numeric` | ✓ |  |  |
| 8 | `created_on` | `timestamptz` | ✓ | now() |  |
| 9 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.product_groups` (19 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `product_group_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `group_code` | `text` |  |  | UNIQUE |
| 3 | `name` | `text` |  |  |  |
| 4 | `default_revenue_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 5 | `default_expense_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 6 | `default_cost_center_id` | `uuid` | ✓ |  | FK → cost_centers.cost_center_id |
| 7 | `default_activity_id` | `uuid` | ✓ |  | FK → activities.activity_id |
| 8 | `purchase_tax_category_id` | `uuid` | ✓ |  | FK → tax_categories.tax_category_id |
| 9 | `sales_tax_category_id` | `uuid` | ✓ |  | FK → tax_categories.tax_category_id |

### `herobm_core.product_suppliers` (18,668 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `product_supplier_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `product_id` | `uuid` |  |  | FK → products.product_id, UNIQUE, UNIQUE |
| 3 | `vendor_id` | `uuid` |  |  | FK → suppliers.vendor_id, UNIQUE, UNIQUE |
| 4 | `supplier_part_number` | `text` | ✓ |  |  |
| 5 | `cost_price` | `numeric` | ✓ | '0'::numeric |  |
| 6 | `discount_percent` | `numeric` | ✓ | '0'::numeric |  |
| 7 | `price_break_quantity` | `numeric` | ✓ |  |  |
| 8 | `is_preferred` | `bool` |  | false |  |
| 9 | `min_purchase_qty` | `numeric` | ✓ |  |  |
| 10 | `purchase_unit` | `text` | ✓ |  |  |
| 11 | `effective_from` | `timestamptz` | ✓ |  |  |
| 12 | `effective_to` | `timestamptz` | ✓ |  |  |
| 13 | `state_code` | `text` |  | 'active'::text |  |
| 14 | `source_id` | `text` | ✓ |  | UNIQUE |
| 15 | `source` | `text` |  | 'app'::text |  |
| 16 | `created_by` | `text` | ✓ |  |  |
| 17 | `created_on` | `timestamptz` | ✓ | now() |  |
| 18 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.product_uoms` (22,975 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `product_uom_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `product_id` | `uuid` |  |  | FK → products.product_id, UNIQUE, UNIQUE |
| 3 | `uom_code` | `text` |  |  | FK → uom_dictionary.uom_code, UNIQUE, UNIQUE |
| 4 | `ratio` | `numeric` |  |  |  |
| 5 | `barcode` | `text` | ✓ |  |  |
| 6 | `is_sales_default` | `bool` | ✓ | false |  |
| 7 | `is_purchase_default` | `bool` | ✓ | false |  |

### `herobm_core.products` (23,001 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `product_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `product_number` | `text` |  |  | UNIQUE |
| 3 | `name` | `text` |  |  |  |
| 4 | `product_type` | `product_type` |  |  |  |
| 5 | `structure_type` | `product_structure` |  | 'standard'::herobm_core.product_struc... |  |
| 6 | `product_group_id` | `uuid` | ✓ |  | FK → product_groups.product_group_id |
| 7 | `barcode` | `text` | ✓ |  |  |
| 8 | `list_price` | `numeric` | ✓ | '0'::numeric |  |
| 9 | `standard_cost` | `numeric` | ✓ | '0'::numeric |  |
| 10 | `trade_price` | `numeric` | ✓ | '0'::numeric |  |
| 11 | `price_level_3` | `numeric` | ✓ | '0'::numeric |  |
| 12 | `price_level_4` | `numeric` | ✓ | '0'::numeric |  |
| 13 | `weighted_average_cost` | `numeric` | ✓ | '0'::numeric |  |
| 14 | `alternate_invoice_description` | `text` | ✓ |  |  |
| 15 | `box_quantity` | `numeric` | ✓ | '1'::numeric |  |
| 16 | `base_uom` | `text` |  |  | FK → uom_dictionary.uom_code |
| 17 | `default_sales_uom_id` | `uuid` | ✓ |  |  |
| 18 | `default_purchase_uom_id` | `uuid` | ✓ |  |  |
| 19 | `purchase_tax_category_id` | `uuid` | ✓ |  | FK → tax_categories.tax_category_id |
| 20 | `sales_tax_category_id` | `uuid` | ✓ |  | FK → tax_categories.tax_category_id |
| 21 | `alternate_product_number` | `text` | ✓ |  |  |
| 22 | `state_code` | `text` |  | 'active'::text |  |
| 23 | `notes` | `text` | ✓ |  |  |
| 24 | `source_id` | `text` | ✓ |  | UNIQUE |
| 25 | `source` | `text` |  | 'app'::text |  |
| 26 | `created_by` | `text` | ✓ |  |  |
| 27 | `created_on` | `timestamptz` | ✓ | now() |  |
| 28 | `modified_on` | `timestamptz` | ✓ | now() |  |
| 29 | `external_tax_code` | `text` | ✓ |  |  |
| 30 | `weight` | `numeric` | ✓ | '0'::numeric |  |

### `herobm_core.purchase_debit_note_lines` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `debit_note_line_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `debit_note_id` | `uuid` |  |  | FK → purchase_debit_notes.debit_note_id |
| 3 | `purchase_order_line_id` | `uuid` |  |  | FK → purchase_order_lines.purchase_order_line_id |
| 4 | `quantity_invoiced` | `numeric` |  |  |  |
| 5 | `price_per_unit` | `numeric` |  |  |  |
| 6 | `amount` | `numeric` |  |  |  |
| 7 | `tax_amount` | `numeric` | ✓ | '0'::numeric |  |

### `herobm_core.purchase_debit_notes` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `debit_note_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `debit_note_number` | `text` |  |  | UNIQUE |
| 3 | `supplier_reference_number` | `text` | ✓ |  |  |
| 4 | `return_id` | `uuid` |  |  | FK → purchase_order_returns.return_id |
| 5 | `purchase_order_id` | `uuid` |  |  | FK → purchase_orders.purchase_order_id |
| 6 | `vendor_id` | `uuid` |  |  | FK → suppliers.vendor_id |
| 7 | `total_amount` | `numeric` |  |  |  |
| 8 | `tax_amount` | `numeric` | ✓ | '0'::numeric |  |
| 9 | `fee_amount` | `numeric` | ✓ | '0'::numeric |  |
| 10 | `outstanding_amount` | `numeric` |  | '0'::numeric |  |
| 11 | `currency_code` | `text` |  |  |  |
| 12 | `state_code` | `text` |  | 'draft'::text |  |
| 13 | `notes` | `text` | ✓ |  |  |
| 14 | `created_by` | `text` | ✓ |  |  |
| 15 | `created_on` | `timestamptz` | ✓ | now() |  |
| 16 | `modified_on` | `timestamptz` | ✓ | now() |  |
| 17 | `base_total_amount` | `numeric` | ✓ | '0'::numeric |  |
| 18 | `base_outstanding_amount` | `numeric` | ✓ | '0'::numeric |  |
| 19 | `exchange_rate` | `numeric` |  | '1'::numeric |  |

### `herobm_core.purchase_invoice_lines` (189,058 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `invoice_line_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `invoice_id` | `uuid` |  |  |  |
| 3 | `purchase_order_line_id` | `uuid` | ✓ |  | FK → purchase_order_lines.purchase_order_line_id |
| 4 | `product_id` | `uuid` | ✓ |  | FK → products.product_id |
| 5 | `gl_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 6 | `description` | `text` | ✓ |  |  |
| 7 | `quantity_invoiced` | `numeric` |  |  |  |
| 8 | `price_per_unit` | `numeric` |  |  |  |
| 9 | `amount` | `numeric` |  |  |  |
| 10 | `match_status` | `text` |  | 'unmatched'::text |  |

### `herobm_core.purchase_invoice_receipts` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `invoice_receipt_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `invoice_line_id` | `uuid` |  |  | FK → purchase_invoice_lines.invoice_line_id |
| 3 | `goods_received_line_id` | `uuid` |  |  | FK → goods_received_lines.goods_received_line_id |
| 4 | `quantity_billed` | `numeric` |  |  |  |

### `herobm_core.purchase_invoices` (31,458 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `invoice_id` | `uuid` | ✓ |  |  |
| 2 | `invoice_number` | `text` | ✓ |  |  |
| 3 | `purchase_order_id` | `uuid` | ✓ |  |  |
| 4 | `vendor_id` | `uuid` | ✓ |  |  |
| 5 | `supplier_invoice_number` | `text` | ✓ |  |  |
| 6 | `total_amount` | `numeric` | ✓ |  |  |
| 7 | `base_total_amount` | `numeric` | ✓ |  |  |
| 8 | `tax_amount` | `numeric` | ✓ |  |  |
| 9 | `currency_code` | `text` | ✓ |  |  |
| 10 | `state_code` | `text` | ✓ |  |  |
| 11 | `notes` | `text` | ✓ |  |  |
| 12 | `created_by` | `text` | ✓ |  |  |
| 13 | `created_on` | `timestamptz` | ✓ |  |  |
| 14 | `invoice_date` | `timestamptz` | ✓ |  |  |
| 15 | `due_date` | `timestamptz` | ✓ |  |  |
| 16 | `terms_description` | `text` | ✓ |  |  |
| 17 | `modified_on` | `timestamptz` | ✓ |  |  |
| 18 | `receipt_filename` | `text` | ✓ |  |  |
| 19 | `outstanding_amount` | `numeric` | ✓ |  |  |
| 20 | `base_outstanding_amount` | `numeric` | ✓ |  |  |
| 21 | `exchange_rate` | `numeric` | ✓ |  |  |
| 22 | `early_payment_discount` | `numeric` | ✓ |  |  |
| 23 | `early_payment_discount_days` | `int4` | ✓ |  |  |

### `herobm_core.purchase_order_lines` (16,302 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `purchase_order_line_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `purchase_order_id` | `uuid` |  |  | FK → purchase_orders.purchase_order_id |
| 3 | `line_number` | `int4` |  |  |  |
| 4 | `product_id` | `uuid` | ✓ |  | FK → products.product_id |
| 5 | `product_description` | `text` | ✓ |  |  |
| 6 | `quantity` | `numeric` |  |  |  |
| 7 | `price_per_unit` | `numeric` |  |  |  |
| 8 | `discount_percentage` | `numeric` | ✓ | '0'::numeric |  |
| 9 | `amount` | `numeric` | ✓ |  |  |
| 10 | `tax_category_id` | `uuid` |  |  | FK → tax_categories.tax_category_id |
| 11 | `tax` | `numeric` | ✓ | '0'::numeric |  |
| 12 | `total_amount` | `numeric` | ✓ |  |  |
| 13 | `unit_of_measure` | `text` | ✓ |  |  |
| 14 | `quantity_received` | `numeric` | ✓ | '0'::numeric |  |

### `herobm_core.purchase_order_return_lines` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `return_line_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `return_id` | `uuid` |  |  | FK → purchase_order_returns.return_id |
| 3 | `purchase_order_line_id` | `uuid` |  |  | FK → purchase_order_lines.purchase_order_line_id |
| 4 | `quantity_returned` | `numeric` |  |  |  |
| 5 | `reason` | `text` | ✓ |  |  |
| 6 | `return_fee` | `numeric` | ✓ | '0'::numeric |  |

### `herobm_core.purchase_order_return_shipment_lines` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `shipment_line_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `shipment_id` | `uuid` |  |  | FK → purchase_order_return_shipments.shipment_id |
| 3 | `return_line_id` | `uuid` |  |  | FK → purchase_order_return_lines.return_line_id |
| 4 | `quantity_shipped` | `numeric` |  |  |  |

### `herobm_core.purchase_order_return_shipments` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `shipment_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `shipment_number` | `text` |  |  | UNIQUE |
| 3 | `return_id` | `uuid` |  |  | FK → purchase_order_returns.return_id |
| 4 | `state_code` | `text` |  | 'dispatched'::text |  |
| 5 | `notes` | `text` | ✓ |  |  |
| 6 | `tracking_number` | `text` | ✓ |  |  |
| 7 | `fulfillment_location_id` | `uuid` | ✓ |  | FK → locations.location_id |
| 8 | `created_by` | `text` | ✓ |  |  |
| 9 | `created_on` | `timestamptz` | ✓ | now() |  |
| 10 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.purchase_order_returns` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `return_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `return_number` | `text` |  |  | UNIQUE |
| 3 | `purchase_order_id` | `uuid` |  |  | FK → purchase_orders.purchase_order_id |
| 4 | `state_code` | `text` |  | 'draft'::text |  |
| 5 | `notes` | `text` | ✓ |  |  |
| 6 | `created_by` | `text` | ✓ |  |  |
| 7 | `created_on` | `timestamptz` | ✓ | now() |  |
| 8 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.purchase_orders` (1,525 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `purchase_order_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `order_number` | `text` |  |  | UNIQUE |
| 3 | `name` | `text` | ✓ |  |  |
| 4 | `vendor_id` | `uuid` | ✓ |  | FK → suppliers.vendor_id |
| 5 | `delivery_location_id` | `uuid` |  |  | FK → locations.location_id |
| 6 | `reference_number` | `text` | ✓ |  |  |
| 7 | `state_code` | `text` |  | 'draft'::text |  |
| 8 | `currency_code` | `text` |  |  |  |
| 9 | `notes` | `text` | ✓ |  |  |
| 10 | `custom_fields` | `jsonb` | ✓ |  |  |
| 11 | `created_by` | `text` | ✓ |  |  |
| 12 | `created_on` | `timestamptz` | ✓ | now() |  |
| 13 | `modified_on` | `timestamptz` | ✓ | now() |  |
| 14 | `expected_date` | `timestamptz` | ✓ |  |  |
| 15 | `terms_description` | `text` | ✓ |  |  |
| 16 | `base_total_amount` | `numeric` | ✓ | '0'::numeric |  |
| 17 | `exchange_rate` | `numeric` |  | '1'::numeric |  |

### `herobm_core.reconciliation_events` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `event_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `entity_type` | `text` |  |  |  |
| 3 | `entity_id` | `uuid` |  |  |  |
| 4 | `event_type` | `text` |  |  |  |
| 5 | `entity_display_name` | `text` | ✓ |  |  |
| 6 | `payload` | `jsonb` | ✓ |  |  |
| 7 | `actor` | `text` | ✓ |  |  |
| 8 | `created_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.reconciliation_rules` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `rule_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `condition_type` | `text` | ✓ |  |  |
| 3 | `condition_value` | `text` | ✓ |  |  |
| 4 | `target_gl_account_id` | `uuid` |  |  | FK → gl_accounts.gl_account_id |
| 5 | `priority` | `int4` |  | 10 |  |
| 6 | `created_on` | `timestamptz` | ✓ | now() |  |
| 7 | `amount_min` | `numeric` | ✓ |  |  |
| 8 | `amount_max` | `numeric` | ✓ |  |  |
| 9 | `cost_center_id` | `uuid` | ✓ |  | FK → cost_centers.cost_center_id |
| 10 | `activity_id` | `uuid` | ✓ |  | FK → activities.activity_id |
| 11 | `party_type` | `text` | ✓ |  |  |
| 12 | `party_id` | `text` | ✓ |  |  |
| 13 | `memo` | `text` | ✓ |  |  |
| 14 | `type_condition` | `text` | ✓ |  |  |
| 15 | `payee_condition_type` | `text` | ✓ |  |  |
| 16 | `payee_condition_value` | `text` | ✓ |  |  |
| 17 | `gl_account_ids` | `jsonb` | ✓ |  |  |

### `herobm_core.sales_credit_note_lines` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `credit_note_line_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `credit_note_id` | `uuid` |  |  | FK → sales_credit_notes.credit_note_id |
| 3 | `sales_order_line_id` | `uuid` | ✓ |  | FK → sales_order_lines.sales_order_line_id |
| 4 | `quantity_credited` | `numeric` |  |  |  |
| 5 | `price_per_unit` | `numeric` |  |  |  |
| 6 | `amount` | `numeric` |  |  |  |
| 7 | `tax_amount` | `numeric` | ✓ | '0'::numeric |  |
| 8 | `description` | `text` | ✓ |  |  |
| 9 | `account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 10 | `tax_category_id` | `uuid` | ✓ |  | FK → tax_categories.tax_category_id |

### `herobm_core.sales_credit_notes` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `credit_note_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `credit_note_number` | `text` |  |  | UNIQUE |
| 3 | `return_id` | `uuid` | ✓ |  | FK → sales_order_returns.return_id |
| 4 | `sales_order_id` | `uuid` | ✓ |  | FK → sales_orders.sales_order_id |
| 5 | `invoice_id` | `uuid` | ✓ |  |  |
| 6 | `total_amount` | `numeric` |  |  |  |
| 7 | `tax_amount` | `numeric` | ✓ | '0'::numeric |  |
| 8 | `fee_amount` | `numeric` | ✓ | '0'::numeric |  |
| 9 | `outstanding_amount` | `numeric` |  | '0'::numeric |  |
| 10 | `currency_code` | `text` |  |  |  |
| 11 | `state_code` | `text` |  | 'draft'::text |  |
| 12 | `notes` | `text` | ✓ |  |  |
| 13 | `created_by` | `text` | ✓ |  |  |
| 14 | `created_on` | `timestamptz` | ✓ | now() |  |
| 15 | `modified_on` | `timestamptz` | ✓ | now() |  |
| 16 | `customer_id` | `uuid` |  |  | FK → customers.customer_id |
| 17 | `base_total_amount` | `numeric` | ✓ | '0'::numeric |  |
| 18 | `base_outstanding_amount` | `numeric` | ✓ | '0'::numeric |  |
| 19 | `exchange_rate` | `numeric` |  | '1'::numeric |  |

### `herobm_core.sales_events` (254 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `event_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `entity_type` | `text` |  |  |  |
| 3 | `entity_id` | `uuid` |  |  |  |
| 4 | `event_type` | `text` |  |  |  |
| 5 | `payload` | `jsonb` | ✓ |  |  |
| 6 | `actor` | `text` | ✓ |  |  |
| 7 | `created_on` | `timestamptz` | ✓ | now() |  |
| 8 | `entity_display_name` | `text` | ✓ |  |  |

### `herobm_core.sales_invoice_lines` (102,346 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `invoice_line_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `invoice_id` | `uuid` |  |  |  |
| 3 | `sales_order_line_id` | `uuid` |  |  | FK → sales_order_lines.sales_order_line_id |
| 4 | `quantity_invoiced` | `numeric` |  |  |  |
| 5 | `price_per_unit` | `numeric` |  |  |  |
| 6 | `amount` | `numeric` |  |  |  |

### `herobm_core.sales_invoices` (12,332 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `invoice_id` | `uuid` | ✓ |  |  |
| 2 | `invoice_number` | `text` | ✓ |  |  |
| 3 | `sales_order_id` | `uuid` | ✓ |  |  |
| 4 | `total_amount` | `numeric` | ✓ |  |  |
| 5 | `base_total_amount` | `numeric` | ✓ |  |  |
| 6 | `tax_amount` | `numeric` | ✓ |  |  |
| 7 | `currency_code` | `text` | ✓ |  |  |
| 8 | `state_code` | `text` | ✓ |  |  |
| 9 | `notes` | `text` | ✓ |  |  |
| 10 | `created_by` | `text` | ✓ |  |  |
| 11 | `created_on` | `timestamptz` | ✓ |  |  |
| 12 | `invoice_date` | `timestamptz` | ✓ |  |  |
| 13 | `due_date` | `timestamptz` | ✓ |  |  |
| 14 | `terms_description` | `text` | ✓ |  |  |
| 15 | `modified_on` | `timestamptz` | ✓ |  |  |
| 16 | `outstanding_amount` | `numeric` | ✓ |  |  |
| 17 | `base_outstanding_amount` | `numeric` | ✓ |  |  |
| 18 | `exchange_rate` | `numeric` | ✓ |  |  |
| 19 | `early_payment_discount` | `numeric` | ✓ |  |  |
| 20 | `early_payment_discount_days` | `int4` | ✓ |  |  |

### `herobm_core.sales_order_lines` (228,825 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `sales_order_line_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `sales_order_id` | `uuid` |  |  | FK → sales_orders.sales_order_id |
| 3 | `line_number` | `int4` |  |  |  |
| 4 | `product_id` | `uuid` | ✓ |  | FK → products.product_id |
| 5 | `product_description` | `text` | ✓ |  |  |
| 6 | `quantity` | `numeric` |  |  |  |
| 7 | `price_per_unit` | `numeric` |  |  |  |
| 8 | `discount_percentage` | `numeric` | ✓ | '0'::numeric |  |
| 9 | `amount` | `numeric` | ✓ |  |  |
| 10 | `tax_category_id` | `uuid` |  |  | FK → tax_categories.tax_category_id |
| 11 | `tax` | `numeric` | ✓ | '0'::numeric |  |
| 12 | `total_amount` | `numeric` | ✓ |  |  |
| 13 | `unit_of_measure` | `text` | ✓ |  |  |
| 14 | `quantity_picked` | `numeric` | ✓ | '0'::numeric |  |
| 15 | `fulfillment_location_id` | `uuid` |  |  | FK → locations.location_id |
| 16 | `is_post_confirmation` | `bool` | ✓ | false |  |
| 17 | `parent_line_id` | `uuid` | ✓ |  | FK → sales_order_lines.sales_order_line_id |

### `herobm_core.sales_order_picks` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `pick_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `sales_order_id` | `uuid` |  |  | FK → sales_orders.sales_order_id |
| 3 | `sales_order_line_id` | `uuid` |  |  | FK → sales_order_lines.sales_order_line_id |
| 4 | `product_id` | `uuid` |  |  | FK → products.product_id |
| 5 | `bin_id` | `uuid` | ✓ |  | FK → bins.bin_id |
| 6 | `quantity` | `numeric` |  |  |  |
| 7 | `state_code` | `text` |  | 'picked'::text |  |
| 8 | `created_by` | `text` | ✓ |  |  |
| 9 | `created_on` | `timestamptz` | ✓ | now() |  |
| 10 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.sales_order_return_lines` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `return_line_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `return_id` | `uuid` |  |  | FK → sales_order_returns.return_id |
| 3 | `sales_order_line_id` | `uuid` |  |  | FK → sales_order_lines.sales_order_line_id |
| 4 | `quantity_returned` | `numeric` |  |  |  |
| 5 | `quantity_received` | `numeric` | ✓ | '0'::numeric |  |
| 6 | `reason` | `text` | ✓ |  |  |
| 7 | `return_fee` | `numeric` | ✓ | '0'::numeric |  |
| 8 | `putaway_status` | `text` |  | 'pending_putaway'::text |  |

### `herobm_core.sales_order_returns` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `return_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `return_number` | `text` |  |  | UNIQUE |
| 3 | `sales_order_id` | `uuid` |  |  | FK → sales_orders.sales_order_id |
| 4 | `state_code` | `text` |  | 'draft'::text |  |
| 5 | `notes` | `text` | ✓ |  |  |
| 6 | `created_by` | `text` | ✓ |  |  |
| 7 | `created_on` | `timestamptz` | ✓ | now() |  |
| 8 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.sales_order_shipment_lines` (1 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `shipment_line_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `shipment_id` | `uuid` |  |  | FK → sales_order_shipments.shipment_id |
| 3 | `sales_order_line_id` | `uuid` |  |  | FK → sales_order_lines.sales_order_line_id |
| 4 | `quantity_shipped` | `numeric` |  |  |  |

### `herobm_core.sales_order_shipments` (1 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `shipment_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `shipment_number` | `text` |  |  | UNIQUE |
| 3 | `sales_order_id` | `uuid` |  |  | FK → sales_orders.sales_order_id |
| 4 | `state_code` | `text` |  | 'dispatched'::text |  |
| 5 | `notes` | `text` | ✓ |  |  |
| 6 | `tracking_number` | `text` | ✓ |  |  |
| 7 | `fulfillment_location_id` | `uuid` | ✓ |  | FK → locations.location_id |
| 8 | `created_by` | `text` | ✓ |  |  |
| 9 | `created_on` | `timestamptz` | ✓ | now() |  |
| 10 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.sales_orders` (17,585 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `sales_order_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `order_number` | `text` |  |  | UNIQUE |
| 3 | `name` | `text` | ✓ |  |  |
| 4 | `customer_id` | `uuid` | ✓ |  | FK → customers.customer_id |
| 5 | `customer_order_number` | `text` | ✓ |  |  |
| 6 | `fulfillment_location_id` | `uuid` |  |  | FK → locations.location_id |
| 7 | `state_code` | `text` |  | 'draft'::text |  |
| 8 | `currency_code` | `text` |  |  |  |
| 9 | `notes` | `text` | ✓ |  |  |
| 10 | `custom_fields` | `jsonb` | ✓ |  |  |
| 11 | `discrepancies_acknowledged` | `bool` |  | false |  |
| 12 | `source_id` | `text` | ✓ |  | UNIQUE |
| 13 | `source` | `text` |  | 'app'::text |  |
| 14 | `created_by` | `text` | ✓ |  |  |
| 15 | `created_on` | `timestamptz` | ✓ | now() |  |
| 16 | `modified_on` | `timestamptz` | ✓ | now() |  |
| 17 | `shipping_notes` | `text` | ✓ |  |  |
| 18 | `delivery_name` | `text` | ✓ |  |  |
| 19 | `delivery_phone` | `text` | ✓ |  |  |
| 20 | `delivery_address_line1` | `text` | ✓ |  |  |
| 21 | `delivery_address_line2` | `text` | ✓ |  |  |
| 22 | `delivery_city` | `text` | ✓ |  |  |
| 23 | `delivery_state` | `text` | ✓ |  |  |
| 24 | `delivery_postal_code` | `text` | ✓ |  |  |
| 25 | `delivery_country` | `text` | ✓ |  |  |
| 26 | `terms_description` | `text` | ✓ |  |  |
| 27 | `credit_hold_override_at` | `timestamptz` | ✓ |  |  |
| 28 | `credit_hold_override_by` | `text` | ✓ |  |  |
| 29 | `credit_hold_override_reason` | `text` | ✓ |  |  |
| 30 | `base_total_amount` | `numeric` | ✓ | '0'::numeric |  |
| 31 | `exchange_rate` | `numeric` |  | '1'::numeric |  |

### `herobm_core.schema_migrations` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `filename` | `text` |  |  | 🔑 PK |
| 2 | `applied_at` | `timestamptz` | ✓ | now() |  |

### `herobm_core.supplier_expiries` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `expiry_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `vendor_id` | `uuid` |  |  | FK → suppliers.vendor_id |
| 3 | `expiry_type` | `text` |  |  |  |
| 4 | `expiry_date` | `date` |  |  |  |
| 5 | `notes` | `text` | ✓ |  |  |
| 6 | `created_by` | `text` | ✓ |  |  |
| 7 | `created_on` | `timestamptz` | ✓ | now() |  |
| 8 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.supplier_groups` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `supplier_group_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `group_code` | `text` |  |  | UNIQUE |
| 3 | `name` | `text` |  |  |  |
| 4 | `default_ap_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 5 | `default_expense_account_id` | `uuid` | ✓ |  | FK → gl_accounts.gl_account_id |
| 6 | `default_cost_center_id` | `uuid` | ✓ |  | FK → cost_centers.cost_center_id |
| 7 | `default_activity_id` | `uuid` | ✓ |  | FK → activities.activity_id |
| 8 | `trading_terms_id` | `uuid` | ✓ |  | FK → trading_terms.trading_terms_id |
| 9 | `early_payment_discount` | `numeric` | ✓ | '0'::numeric |  |
| 10 | `credit_limit` | `numeric` | ✓ | '0'::numeric |  |
| 11 | `is_purchasing_blocked` | `bool` |  | false |  |
| 12 | `purchasing_block_reason` | `text` | ✓ |  |  |
| 13 | `is_payment_blocked` | `bool` |  | false |  |
| 14 | `payment_block_reason` | `text` | ✓ |  |  |
| 15 | `block_notes` | `text` | ✓ |  |  |
| 16 | `tax_position_id` | `uuid` | ✓ |  | FK → tax_positions.tax_position_id |
| 17 | `early_payment_discount_days` | `int4` | ✓ |  |  |

### `herobm_core.suppliers` (365 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `vendor_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `vendor_number` | `text` |  |  | UNIQUE |
| 3 | `name` | `text` |  |  |  |
| 4 | `supplier_group_id` | `uuid` | ✓ |  | FK → supplier_groups.supplier_group_id |
| 5 | `address1_line1` | `text` | ✓ |  |  |
| 6 | `address1_line2` | `text` | ✓ |  |  |
| 7 | `address1_city` | `text` | ✓ |  |  |
| 8 | `address1_state_or_province` | `text` | ✓ |  |  |
| 9 | `address1_postal_code` | `text` | ✓ |  |  |
| 10 | `address1_country` | `text` |  |  |  |
| 11 | `telephone1` | `text` | ✓ |  |  |
| 12 | `fax` | `text` | ✓ |  |  |
| 13 | `email_address1` | `text` | ✓ |  |  |
| 14 | `trading_terms_id` | `uuid` | ✓ |  | FK → trading_terms.trading_terms_id |
| 15 | `early_payment_discount` | `numeric` | ✓ |  |  |
| 16 | `credit_limit` | `numeric` | ✓ |  |  |
| 17 | `is_purchasing_blocked` | `bool` | ✓ |  |  |
| 18 | `purchasing_block_reason` | `text` | ✓ |  |  |
| 19 | `is_payment_blocked` | `bool` | ✓ |  |  |
| 20 | `payment_block_reason` | `text` | ✓ |  |  |
| 21 | `block_notes` | `text` | ✓ |  |  |
| 22 | `currency_code` | `text` |  |  |  |
| 23 | `state_code` | `text` |  | 'active'::text |  |
| 24 | `external_id` | `text` | ✓ |  |  |
| 25 | `notes` | `text` | ✓ |  |  |
| 26 | `bank_account_name` | `text` | ✓ |  |  |
| 27 | `bank_bsb` | `text` | ✓ |  |  |
| 28 | `bank_account_number` | `text` | ✓ |  |  |
| 29 | `source_id` | `text` | ✓ |  | UNIQUE |
| 30 | `source` | `text` |  | 'app'::text |  |
| 31 | `created_by` | `text` | ✓ |  |  |
| 32 | `created_on` | `timestamptz` | ✓ | now() |  |
| 33 | `modified_on` | `timestamptz` | ✓ | now() |  |
| 34 | `business_number` | `text` | ✓ |  |  |
| 35 | `is_tax_registered` | `bool` |  | false |  |
| 36 | `tax_position_id` | `uuid` | ✓ |  | FK → tax_positions.tax_position_id |
| 37 | `early_payment_discount_days` | `int4` | ✓ |  |  |

### `herobm_core.system_events` (39 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `event_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `entity_type` | `text` |  |  |  |
| 3 | `entity_id` | `uuid` |  |  |  |
| 4 | `event_type` | `text` |  |  |  |
| 5 | `payload` | `jsonb` | ✓ |  |  |
| 6 | `actor` | `text` | ✓ |  |  |
| 7 | `created_on` | `timestamptz` | ✓ | now() |  |
| 8 | `entity_display_name` | `text` | ✓ |  |  |

### `herobm_core.tax_categories` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `tax_category_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `code` | `text` |  |  | UNIQUE |
| 3 | `title` | `text` |  |  |  |
| 4 | `type` | `text` |  |  |  |
| 5 | `rate` | `numeric` | ✓ | '0'::numeric |  |

### `herobm_core.tax_position_mappings` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `mapping_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `tax_position_id` | `uuid` |  |  | FK → tax_positions.tax_position_id |
| 3 | `source_tax_category_id` | `uuid` |  |  | FK → tax_categories.tax_category_id |
| 4 | `destination_tax_category_id` | `uuid` |  |  | FK → tax_categories.tax_category_id |

### `herobm_core.tax_positions` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `tax_position_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `code` | `text` |  |  | UNIQUE |
| 3 | `title` | `text` |  |  |  |

### `herobm_core.trading_terms` (43 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `trading_terms_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `code` | `text` |  |  | UNIQUE |
| 3 | `description` | `text` |  |  |  |
| 4 | `days` | `int4` |  |  |  |
| 5 | `type` | `text` |  |  |  |
| 6 | `created_on` | `timestamptz` | ✓ | now() |  |
| 7 | `source_id` | `text` | ✓ |  |  |
| 8 | `source` | `text` | ✓ |  |  |
| 9 | `is_active` | `bool` |  | true |  |
| 10 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.transfer_order_lines` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `transfer_order_line_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `transfer_order_id` | `uuid` |  |  | FK → transfer_orders.transfer_order_id |
| 3 | `product_id` | `uuid` |  |  | FK → products.product_id |
| 4 | `quantity` | `numeric` |  |  |  |
| 5 | `quantity_shipped` | `numeric` | ✓ | '0'::numeric |  |
| 6 | `quantity_received` | `numeric` | ✓ | '0'::numeric |  |

### `herobm_core.transfer_order_picks` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `pick_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `transfer_order_id` | `uuid` |  |  | FK → transfer_orders.transfer_order_id |
| 3 | `transfer_order_line_id` | `uuid` |  |  | FK → transfer_order_lines.transfer_order_line_id |
| 4 | `product_id` | `uuid` |  |  | FK → products.product_id |
| 5 | `bin_id` | `uuid` | ✓ |  | FK → bins.bin_id |
| 6 | `quantity` | `numeric` |  |  |  |
| 7 | `state_code` | `text` |  | 'picked'::text |  |
| 8 | `created_by` | `text` | ✓ |  |  |
| 9 | `created_on` | `timestamptz` | ✓ | now() |  |
| 10 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.transfer_order_receipt_lines` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `receipt_line_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `receipt_id` | `uuid` |  |  | FK → transfer_order_receipts.receipt_id |
| 3 | `transfer_order_line_id` | `uuid` |  |  | FK → transfer_order_lines.transfer_order_line_id |
| 4 | `product_id` | `uuid` |  |  | FK → products.product_id |
| 5 | `bin_id` | `uuid` |  |  | FK → bins.bin_id |
| 6 | `quantity` | `numeric` |  |  |  |

### `herobm_core.transfer_order_receipts` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `receipt_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `transfer_order_id` | `uuid` |  |  | FK → transfer_orders.transfer_order_id |
| 3 | `receipt_number` | `text` |  |  | UNIQUE |
| 4 | `state_code` | `text` |  | 'received'::text |  |
| 5 | `received_by` | `text` | ✓ |  |  |
| 6 | `received_on` | `timestamptz` | ✓ | now() |  |
| 7 | `created_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.transfer_order_shipment_lines` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `shipment_line_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `shipment_id` | `uuid` |  |  | FK → transfer_order_shipments.shipment_id |
| 3 | `transfer_order_line_id` | `uuid` |  |  | FK → transfer_order_lines.transfer_order_line_id |
| 4 | `pick_id` | `uuid` | ✓ |  | FK → transfer_order_picks.pick_id |
| 5 | `product_id` | `uuid` |  |  | FK → products.product_id |
| 6 | `quantity` | `numeric` |  |  |  |

### `herobm_core.transfer_order_shipments` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `shipment_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `transfer_order_id` | `uuid` |  |  | FK → transfer_orders.transfer_order_id |
| 3 | `shipment_number` | `text` |  |  | UNIQUE |
| 4 | `tracking_number` | `text` | ✓ |  |  |
| 5 | `carrier_id` | `uuid` | ✓ |  |  |
| 6 | `state_code` | `text` |  | 'dispatched'::text |  |
| 7 | `shipped_by` | `text` | ✓ |  |  |
| 8 | `shipped_on` | `timestamptz` | ✓ | now() |  |
| 9 | `created_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.transfer_orders` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `transfer_order_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `order_number` | `text` |  |  | UNIQUE |
| 3 | `source_location_id` | `uuid` |  |  | FK → locations.location_id |
| 4 | `destination_location_id` | `uuid` |  |  | FK → locations.location_id |
| 5 | `state_code` | `text` |  | 'confirmed'::text |  |
| 6 | `notes` | `text` | ✓ |  |  |
| 7 | `created_by` | `text` | ✓ |  |  |
| 8 | `created_on` | `timestamptz` | ✓ | now() |  |
| 9 | `modified_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.uom_dictionary` (1 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `uom_code` | `text` |  |  | 🔑 PK |
| 2 | `description` | `text` |  |  |  |
| 3 | `created_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.user_events` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `event_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `user_id` | `uuid` |  |  | FK → users.user_id |
| 3 | `event_type` | `text` |  |  |  |
| 4 | `payload` | `jsonb` | ✓ |  |  |
| 5 | `actor` | `text` | ✓ |  |  |
| 6 | `created_on` | `timestamptz` | ✓ | now() |  |
| 7 | `entity_display_name` | `text` | ✓ |  |  |

### `herobm_core.user_settings` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `user_id` | `uuid` |  |  | FK → users.user_id, 🔑 PK |
| 2 | `dashboard_config` | `jsonb` | ✓ | '{}'::jsonb |  |
| 3 | `report_configs` | `jsonb` | ✓ | '{}'::jsonb |  |
| 4 | `preferences` | `jsonb` | ✓ | '{}'::jsonb |  |
| 5 | `updated_at` | `timestamptz` |  | now() |  |

### `herobm_core.users` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `user_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `username` | `text` |  |  | UNIQUE |
| 3 | `password_hash` | `text` |  |  |  |
| 4 | `display_name` | `text` | ✓ |  |  |
| 5 | `email` | `text` | ✓ |  |  |
| 6 | `role` | `text` |  |  |  |
| 7 | `is_active` | `bool` |  | true |  |
| 8 | `created_at` | `timestamptz` |  | now() |  |

### `herobm_core.warehouse_events` (10 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `event_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `entity_type` | `text` |  |  |  |
| 3 | `entity_id` | `uuid` |  |  |  |
| 4 | `event_type` | `text` |  |  |  |
| 5 | `payload` | `jsonb` | ✓ |  |  |
| 6 | `actor` | `text` | ✓ |  |  |
| 7 | `created_on` | `timestamptz` | ✓ | now() |  |
| 8 | `entity_display_name` | `text` | ✓ |  |  |

### `herobm_core.webhooks` (0 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `webhook_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `target_url` | `text` |  |  |  |
| 3 | `event_types` | `jsonb` |  |  |  |
| 4 | `secret_key` | `text` |  |  |  |
| 5 | `is_active` | `bool` |  | true |  |
| 6 | `created_on` | `timestamptz` | ✓ | now() |  |

### `herobm_core.zones` (12 rows)

| # | Column | Type | Nullable | Default | Constraints |
|---|--------|------|----------|---------|------------|
| 1 | `zone_id` | `uuid` |  | gen_random_uuid() | 🔑 PK |
| 2 | `location_id` | `uuid` |  |  | FK → locations.location_id, UNIQUE, UNIQUE |
| 3 | `code` | `text` |  |  | UNIQUE, UNIQUE |
| 4 | `name` | `text` |  |  |  |
| 5 | `source_id` | `text` | ✓ |  | UNIQUE |
| 6 | `source` | `text` |  | 'app'::text |  |
| 7 | `created_by` | `text` | ✓ |  |  |
| 8 | `created_on` | `timestamptz` | ✓ | now() |  |
| 9 | `modified_on` | `timestamptz` | ✓ | now() |  |

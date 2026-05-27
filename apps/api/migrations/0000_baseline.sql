CREATE SCHEMA IF NOT EXISTS "modbm_core";
--> statement-breakpoint
CREATE TYPE "modbm_core"."bin_type_enum" AS ENUM('storage', 'pick', 'bulk', 'receiving', 'staging', 'quarantine', 'in_transit');--> statement-breakpoint
CREATE TYPE "modbm_core"."fractional_behavior" AS ENUM('allow_fractional', 'round_up', 'round_down', 'force_multiple');--> statement-breakpoint
CREATE TYPE "modbm_core"."product_structure" AS ENUM('standard', 'kit');--> statement-breakpoint
CREATE TYPE "modbm_core"."product_type" AS ENUM('inventory', 'non-stock', 'service');--> statement-breakpoint
CREATE TABLE "modbm_core"."activities" (
	"activity_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "activities_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."api_keys" (
	"api_key_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."app_settings" (
	"settings_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"default_fulfillment_location_id" uuid,
	"inventory_valuation_method" text DEFAULT 'weighted_average' NOT NULL,
	"inventory_accounting_mode" text DEFAULT 'periodic' NOT NULL,
	"non_stock_billing_mode" text DEFAULT 'per_shipment' NOT NULL,
	"credit_limit_behavior" text DEFAULT 'soft' NOT NULL,
	"api_rate_limit" numeric DEFAULT '1000' NOT NULL,
	"setup_completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."backorders" (
	"backorder_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"purchase_order_line_id" uuid,
	"transfer_order_id" uuid,
	"transfer_order_line_id" uuid,
	"quantity" numeric NOT NULL,
	"state_code" text DEFAULT 'pending_supply' NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."bin_contents" (
	"bin_content_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bin_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"actual_quantity" numeric DEFAULT '0' NOT NULL,
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "bin_contents_bin_product_unq" UNIQUE("bin_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."bins" (
	"bin_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bin_number" text NOT NULL,
	"zone_id" uuid NOT NULL,
	"bin_type" "modbm_core"."bin_type_enum" DEFAULT 'storage' NOT NULL,
	"is_consignment" boolean DEFAULT false,
	"is_bonded" boolean DEFAULT false,
	"is_unavailable" boolean DEFAULT false,
	"source_id" text,
	"source" text DEFAULT 'app' NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "bins_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "bins_bin_number_zone_unq" UNIQUE("bin_number","zone_id")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."cost_centers" (
	"cost_center_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "cost_centers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."customer_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."customer_groups" (
	"customer_group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_code" text NOT NULL,
	"name" text NOT NULL,
	"default_ar_account_id" uuid,
	"default_revenue_account_id" uuid,
	"trading_terms_id" uuid,
	"default_cost_center_id" uuid,
	"default_activity_id" uuid,
	"credit_limit" numeric DEFAULT '0',
	"is_on_credit_hold" boolean DEFAULT false NOT NULL,
	CONSTRAINT "customer_groups_group_code_unique" UNIQUE("group_code")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."customers" (
	"customer_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_number" text NOT NULL,
	"name" text NOT NULL,
	"address1_line1" text,
	"address1_line2" text,
	"address1_city" text,
	"address1_state_or_province" text,
	"address1_postal_code" text,
	"address1_country" text,
	"telephone1" text,
	"fax" text,
	"email_address1" text,
	"primary_contact_name" text,
	"primary_contact_email" text,
	"primary_contact_phone" text,
	"customer_group_id" uuid,
	"state_code" text DEFAULT 'active' NOT NULL,
	"tax_category_id" uuid,
	"currency_code" text NOT NULL,
	"trading_terms_id" uuid,
	"credit_limit" numeric,
	"is_on_credit_hold" boolean DEFAULT false NOT NULL,
	"bank_account_name" text,
	"bank_bsb" text,
	"bank_account_number" text,
	"external_id" text,
	"source_id" text,
	"source" text DEFAULT 'app' NOT NULL,
	"price_tier" text,
	"notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "customers_customer_number_unique" UNIQUE("customer_number"),
	CONSTRAINT "customers_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "customers_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'))
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."discount_matrix" (
	"discount_matrix_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_group_id" uuid,
	"customer_id" uuid,
	"product_group_id" uuid,
	"discount_percentage" numeric DEFAULT '0' NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "discount_matrix_group_product_unq" UNIQUE("customer_group_id","product_group_id"),
	CONSTRAINT "discount_matrix_customer_product_unq" UNIQUE("customer_id","product_group_id"),
	CONSTRAINT "discount_matrix_owner_check" CHECK ((customer_group_id IS NOT NULL AND customer_id IS NULL) OR
          (customer_group_id IS NULL AND customer_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."exchange_rates" (
	"exchange_rate_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"currency_code" text NOT NULL,
	"currency_name" text NOT NULL,
	"buy_rate" numeric NOT NULL,
	"sell_rate" numeric NOT NULL,
	"effective_date" timestamp DEFAULT now(),
	"updated_on" timestamp DEFAULT now(),
	CONSTRAINT "exchange_rates_currency_code_unique" UNIQUE("currency_code"),
	CONSTRAINT "exchange_rates_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'))
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."gl_accounts" (
	"gl_account_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_code" text NOT NULL,
	"name" text NOT NULL,
	"account_type" text NOT NULL,
	"parent_account_id" uuid,
	"is_group" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_bank_account" boolean DEFAULT false NOT NULL,
	"currency_code" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "gl_accounts_account_code_unique" UNIQUE("account_code"),
	CONSTRAINT "gl_accounts_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'))
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."gl_journal_entries" (
	"journal_entry_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_number" text NOT NULL,
	"entry_date" date NOT NULL,
	"memo" text,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"is_reversed" boolean DEFAULT false NOT NULL,
	"reversed_by" uuid,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "gl_journal_entries_entry_number_unique" UNIQUE("entry_number")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."gl_journal_lines" (
	"journal_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"gl_account_id" uuid NOT NULL,
	"party_type" text,
	"party_id" text,
	"debit" numeric DEFAULT '0' NOT NULL,
	"credit" numeric DEFAULT '0' NOT NULL,
	"memo" text,
	"is_reconciled" boolean DEFAULT false NOT NULL,
	"reconciliation_id" uuid,
	"cost_center_id" uuid,
	"activity_id" uuid
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."gl_reconciliations" (
	"reconciliation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gl_account_id" uuid NOT NULL,
	"statement_date" date NOT NULL,
	"statement_balance" numeric NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"posted_on" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."gl_settings" (
	"settings_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_metadata_schema" jsonb DEFAULT '[]'::jsonb,
	"fiscal_year_start_month" integer NOT NULL,
	"default_ar_account_id" uuid,
	"default_ap_account_id" uuid,
	"default_revenue_account_id" uuid,
	"default_cogs_account_id" uuid,
	"default_tax_account_id" uuid,
	"default_expense_account_id" uuid,
	"default_inventory_account_id" uuid,
	"default_grni_account_id" uuid,
	"default_shrinkage_account_id" uuid,
	"base_currency" text NOT NULL,
	"revenue_routing_precedence" text DEFAULT 'product_first' NOT NULL,
	"expense_routing_precedence" text DEFAULT 'product_first' NOT NULL,
	"default_fee_revenue_account_id" uuid
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."goods_received" (
	"goods_received_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_number" text NOT NULL,
	"vendor_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"packing_slip_number" text,
	"notes" text,
	"state_code" text DEFAULT 'received' NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "goods_received_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."goods_received_lines" (
	"goods_received_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goods_received_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity_received" numeric NOT NULL,
	"match_status" text DEFAULT 'unmatched' NOT NULL,
	"putaway_status" text DEFAULT 'pending_putaway' NOT NULL,
	"purchase_order_line_id" uuid,
	"purchase_order_id" uuid
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."inventory_entries" (
	"entry_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_number" text NOT NULL,
	"entry_date" timestamp with time zone DEFAULT now() NOT NULL,
	"memo" text,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"is_reversed" boolean DEFAULT false NOT NULL,
	"reversed_by" uuid,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "inventory_entries_entry_number_unique" UNIQUE("entry_number")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."inventory_ledger" (
	"ledger_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"bin_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"quantity" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."locations" (
	"location_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address_line_1" text,
	"city" text,
	"state" text,
	"country" text,
	"post_code" text,
	"source_id" text,
	"source" text DEFAULT 'app' NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "locations_code_unique" UNIQUE("code"),
	CONSTRAINT "locations_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."macros" (
	"macro_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"macro_type" text DEFAULT 'text_template' NOT NULL,
	"content" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "macros_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."order_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."organization" (
	"organization_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address_line_1" text,
	"address_line_2" text,
	"city" text,
	"state" text,
	"country" text,
	"post_code" text,
	"email" text,
	"phone" text,
	"website" text,
	"company_number" text,
	"tax_number" text,
	"logo_url" text,
	"bank_name" text,
	"bank_account_name" text,
	"bank_account_number" text,
	"bank_swift_bic" text,
	"bank_iban" text
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."outbox" (
	"outbox_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"created_on" timestamp with time zone DEFAULT now(),
	"processed_at" timestamp with time zone,
	"locked_until" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."payment_allocations" (
	"allocation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" uuid NOT NULL,
	"allocated_amount" numeric NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."payment_entries" (
	"payment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_number" text NOT NULL,
	"payment_type" text NOT NULL,
	"party_type" text NOT NULL,
	"party_id" uuid NOT NULL,
	"payment_date" timestamp with time zone NOT NULL,
	"mode_of_payment" text NOT NULL,
	"total_amount" numeric NOT NULL,
	"unallocated_amount" numeric NOT NULL,
	"gl_account_bank" uuid NOT NULL,
	"reference_number" text,
	"state_code" text DEFAULT 'draft' NOT NULL,
	"currency_code" text NOT NULL,
	"created_by" text,
	"aba_exported_at" timestamp with time zone,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "payment_entries_payment_number_unique" UNIQUE("payment_number")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."payment_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."product_components" (
	"component_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_product_id" uuid NOT NULL,
	"child_product_id" uuid NOT NULL,
	"parent_quantity" numeric(14, 4) DEFAULT '1' NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"sequence_number" integer DEFAULT 0,
	"fractional_behavior" "modbm_core"."fractional_behavior" DEFAULT 'allow_fractional' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."product_default_bins" (
	"product_default_bin_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"bin_id" uuid NOT NULL,
	"is_primary_per_loc" boolean DEFAULT true NOT NULL,
	"min_quantity" numeric DEFAULT '0',
	"max_quantity" numeric,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "product_default_bins_prod_loc_bin_unq" UNIQUE("product_id","location_id","bin_id")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."product_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."product_groups" (
	"product_group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_code" text NOT NULL,
	"name" text NOT NULL,
	"default_revenue_account_id" uuid,
	"default_expense_account_id" uuid,
	"default_cost_center_id" uuid,
	"default_activity_id" uuid,
	CONSTRAINT "product_groups_group_code_unique" UNIQUE("group_code")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."product_supplier_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_supplier_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."product_suppliers" (
	"product_supplier_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"supplier_part_number" text,
	"cost_price" numeric DEFAULT '0',
	"discount_percent" numeric DEFAULT '0',
	"price_break_quantity" numeric,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"min_purchase_qty" numeric,
	"purchase_unit" text,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"state_code" text DEFAULT 'active' NOT NULL,
	"source_id" text,
	"source" text DEFAULT 'app' NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "product_suppliers_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "product_suppliers_supplier_product_unq" UNIQUE("vendor_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."product_uoms" (
	"product_uom_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"uom_code" text NOT NULL,
	"ratio" numeric(14, 6) NOT NULL,
	"barcode" text,
	"is_sales_default" boolean DEFAULT false,
	"is_purchase_default" boolean DEFAULT false,
	CONSTRAINT "product_uoms_product_code_unq" UNIQUE("product_id","uom_code")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."products" (
	"product_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_number" text NOT NULL,
	"name" text NOT NULL,
	"product_type" "modbm_core"."product_type" DEFAULT 'inventory' NOT NULL,
	"structure_type" "modbm_core"."product_structure" DEFAULT 'standard' NOT NULL,
	"product_group_id" uuid,
	"barcode" text,
	"list_price" numeric(12, 2) DEFAULT '0',
	"standard_cost" numeric(12, 2) DEFAULT '0',
	"trade_price" numeric(12, 2) DEFAULT '0',
	"price_level_3" numeric(12, 2) DEFAULT '0',
	"price_level_4" numeric(12, 2) DEFAULT '0',
	"weighted_average_cost" numeric DEFAULT '0',
	"alternate_invoice_description" text,
	"box_quantity" numeric DEFAULT '1',
	"base_uom" text DEFAULT 'EA' NOT NULL,
	"default_sales_uom_id" uuid,
	"default_purchase_uom_id" uuid,
	"purchase_tax_category_id" uuid,
	"sales_tax_category_id" uuid,
	"alternate_product_number" text,
	"state_code" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"source_id" text,
	"source" text DEFAULT 'app' NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "products_product_number_unique" UNIQUE("product_number"),
	CONSTRAINT "products_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_debit_note_lines" (
	"debit_note_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_id" uuid NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"quantity_invoiced" numeric NOT NULL,
	"price_per_unit" numeric NOT NULL,
	"amount" numeric NOT NULL,
	"tax_amount" numeric DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_debit_notes" (
	"debit_note_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_number" text NOT NULL,
	"supplier_reference_number" text,
	"return_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"total_amount" numeric NOT NULL,
	"tax_amount" numeric DEFAULT '0',
	"fee_amount" numeric DEFAULT '0',
	"outstanding_amount" numeric DEFAULT '0' NOT NULL,
	"currency_code" text NOT NULL,
	"state_code" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "purchase_debit_notes_debit_note_number_unique" UNIQUE("debit_note_number"),
	CONSTRAINT "purchase_debit_notes_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR')),
	CONSTRAINT "purchase_debit_note_state_check" CHECK (state_code IN ('draft', 'posted', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_invoice_lines" (
	"invoice_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"purchase_order_line_id" uuid,
	"product_id" uuid,
	"gl_account_id" uuid,
	"description" text,
	"quantity_invoiced" numeric NOT NULL,
	"price_per_unit" numeric NOT NULL,
	"amount" numeric NOT NULL,
	"match_status" text DEFAULT 'unmatched' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_invoice_receipts" (
	"invoice_receipt_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_line_id" uuid NOT NULL,
	"goods_received_line_id" uuid NOT NULL,
	"quantity_billed" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_invoices" (
	"invoice_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"vendor_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"supplier_invoice_number" text,
	"receipt_filename" text,
	"total_amount" numeric NOT NULL,
	"outstanding_amount" numeric DEFAULT '0' NOT NULL,
	"tax_amount" numeric DEFAULT '0',
	"currency_code" text NOT NULL,
	"state_code" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "purchase_invoices_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "purchase_invoices_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'))
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_order_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_order_lines" (
	"purchase_order_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"product_id" uuid,
	"product_description" text,
	"quantity" numeric NOT NULL,
	"price_per_unit" numeric NOT NULL,
	"discount_percentage" numeric DEFAULT '0',
	"amount" numeric,
	"tax_category_id" uuid NOT NULL,
	"tax" numeric DEFAULT '0',
	"total_amount" numeric,
	"unit_of_measure" text,
	"quantity_received" numeric DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_order_return_lines" (
	"return_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"quantity_returned" numeric NOT NULL,
	"reason" text,
	"return_fee" numeric DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_order_return_shipment_lines" (
	"shipment_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"return_line_id" uuid NOT NULL,
	"quantity_shipped" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_order_return_shipments" (
	"shipment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_number" text NOT NULL,
	"return_id" uuid NOT NULL,
	"state_code" text DEFAULT 'dispatched' NOT NULL,
	"notes" text,
	"tracking_number" text,
	"fulfillment_location_id" uuid,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "purchase_order_return_shipments_shipment_number_unique" UNIQUE("shipment_number"),
	CONSTRAINT "po_return_shipment_state_check" CHECK (state_code IN ('draft', 'dispatched', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_order_returns" (
	"return_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_number" text NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"state_code" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "purchase_order_returns_return_number_unique" UNIQUE("return_number"),
	CONSTRAINT "po_return_state_check" CHECK (state_code IN ('draft', 'staged', 'shipped', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_orders" (
	"purchase_order_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"name" text,
	"vendor_id" uuid,
	"delivery_location_id" uuid NOT NULL,
	"reference_number" text,
	"state_code" text DEFAULT 'draft' NOT NULL,
	"currency_code" text NOT NULL,
	"notes" text,
	"custom_fields" jsonb,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "purchase_orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "purchase_orders_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR')),
	CONSTRAINT "purchase_order_state_check" CHECK (state_code IN ('draft', 'ordered', 'partially_received', 'received', 'invoiced', 'cancelled', 'closed_short', 'legacy', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."report_contexts" (
	"report_id" uuid NOT NULL,
	"context" text NOT NULL,
	CONSTRAINT "report_contexts_report_id_context_pk" PRIMARY KEY("report_id","context")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."report_hook_assignments" (
	"hook_slug" text PRIMARY KEY NOT NULL,
	"report_id" uuid NOT NULL,
	"context_slug" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"template" text NOT NULL,
	"mock_data" jsonb,
	"output_name_pattern" text DEFAULT 'Report.pdf',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."sales_credit_note_lines" (
	"credit_note_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_id" uuid NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"quantity_credited" numeric NOT NULL,
	"price_per_unit" numeric NOT NULL,
	"amount" numeric NOT NULL,
	"tax_amount" numeric DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."sales_credit_notes" (
	"credit_note_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_number" text NOT NULL,
	"return_id" uuid NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"invoice_id" uuid,
	"total_amount" numeric NOT NULL,
	"tax_amount" numeric DEFAULT '0',
	"fee_amount" numeric DEFAULT '0',
	"outstanding_amount" numeric DEFAULT '0' NOT NULL,
	"currency_code" text NOT NULL,
	"state_code" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sales_credit_notes_credit_note_number_unique" UNIQUE("credit_note_number"),
	CONSTRAINT "sales_credit_notes_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'))
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."sales_invoice_lines" (
	"invoice_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"quantity_invoiced" numeric NOT NULL,
	"price_per_unit" numeric NOT NULL,
	"amount" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."sales_invoices" (
	"invoice_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"total_amount" numeric NOT NULL,
	"outstanding_amount" numeric DEFAULT '0' NOT NULL,
	"tax_amount" numeric DEFAULT '0',
	"currency_code" text NOT NULL,
	"state_code" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sales_invoices_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "sales_invoices_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'))
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."sales_order_lines" (
	"sales_order_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"product_id" uuid,
	"product_description" text,
	"quantity" numeric NOT NULL,
	"price_per_unit" numeric NOT NULL,
	"discount_percentage" numeric DEFAULT '0',
	"amount" numeric,
	"tax_category_id" uuid NOT NULL,
	"tax" numeric DEFAULT '0',
	"total_amount" numeric,
	"unit_of_measure" text,
	"quantity_picked" numeric DEFAULT '0',
	"fulfillment_location_id" uuid NOT NULL,
	"is_post_confirmation" boolean DEFAULT false,
	"parent_line_id" uuid
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."sales_order_picks" (
	"pick_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"bin_id" uuid,
	"quantity" numeric NOT NULL,
	"state_code" text DEFAULT 'picked' NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sales_order_pick_state_check" CHECK (state_code IN ('picked', 'shipped', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."sales_order_return_lines" (
	"return_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"quantity_returned" numeric NOT NULL,
	"quantity_received" numeric DEFAULT '0',
	"reason" text,
	"return_fee" numeric DEFAULT '0',
	"putaway_status" text DEFAULT 'pending_putaway' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."sales_order_returns" (
	"return_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_number" text NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"state_code" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sales_order_returns_return_number_unique" UNIQUE("return_number"),
	CONSTRAINT "return_state_check" CHECK (state_code IN ('draft', 'confirmed', 'partially_received', 'received', 'processed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."sales_order_shipment_lines" (
	"shipment_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"quantity_shipped" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."sales_order_shipments" (
	"shipment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_number" text NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"state_code" text DEFAULT 'dispatched' NOT NULL,
	"notes" text,
	"tracking_number" text,
	"fulfillment_location_id" uuid,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sales_order_shipments_shipment_number_unique" UNIQUE("shipment_number"),
	CONSTRAINT "shipment_state_check" CHECK (state_code IN ('draft', 'dispatched', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."sales_orders" (
	"sales_order_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"name" text,
	"customer_id" uuid,
	"customer_order_number" text,
	"fulfillment_location_id" uuid NOT NULL,
	"state_code" text DEFAULT 'draft' NOT NULL,
	"currency_code" text NOT NULL,
	"notes" text,
	"custom_fields" jsonb,
	"discrepancies_acknowledged" boolean DEFAULT false NOT NULL,
	"source_id" text,
	"source" text DEFAULT 'app' NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sales_orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "sales_orders_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "sales_orders_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR')),
	CONSTRAINT "sales_order_state_check" CHECK (state_code IN ('draft', 'quoted', 'confirmed', 'picking', 'shipped', 'invoiced', 'cancelled', 'archived', 'legacy'))
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."shipment_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."supplier_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."supplier_expiries" (
	"expiry_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"expiry_type" text NOT NULL,
	"expiry_date" date NOT NULL,
	"notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."supplier_groups" (
	"supplier_group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_code" text NOT NULL,
	"name" text NOT NULL,
	"default_ap_account_id" uuid,
	"default_expense_account_id" uuid,
	"default_cost_center_id" uuid,
	"default_activity_id" uuid,
	"trading_terms_id" uuid,
	"early_payment_discount" numeric DEFAULT '0',
	"credit_limit" numeric DEFAULT '0',
	"is_purchasing_blocked" boolean DEFAULT false NOT NULL,
	"purchasing_block_reason" text,
	"is_payment_blocked" boolean DEFAULT false NOT NULL,
	"payment_block_reason" text,
	"block_notes" text,
	CONSTRAINT "supplier_groups_group_code_unique" UNIQUE("group_code")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."suppliers" (
	"vendor_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_number" text NOT NULL,
	"name" text NOT NULL,
	"supplier_group_id" uuid,
	"address1_line1" text,
	"address1_line2" text,
	"address1_city" text,
	"address1_state_or_province" text,
	"address1_postal_code" text,
	"address1_country" text,
	"telephone1" text,
	"fax" text,
	"email_address1" text,
	"trading_terms_id" uuid,
	"early_payment_discount" numeric,
	"credit_limit" numeric,
	"is_purchasing_blocked" boolean DEFAULT false NOT NULL,
	"purchasing_block_reason" text,
	"is_payment_blocked" boolean DEFAULT false NOT NULL,
	"payment_block_reason" text,
	"block_notes" text,
	"currency_code" text NOT NULL,
	"state_code" text DEFAULT 'active' NOT NULL,
	"external_id" text,
	"notes" text,
	"bank_account_name" text,
	"bank_bsb" text,
	"bank_account_number" text,
	"source_id" text,
	"source" text DEFAULT 'app' NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "suppliers_vendor_number_unique" UNIQUE("vendor_number"),
	CONSTRAINT "suppliers_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "suppliers_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'))
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."system_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."tax_categories" (
	"tax_category_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"rate" numeric DEFAULT '0',
	"is_default" boolean DEFAULT false,
	CONSTRAINT "tax_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."trading_terms" (
	"trading_terms_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"days" integer NOT NULL,
	"type" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "trading_terms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."transfer_order_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_order_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."transfer_order_lines" (
	"transfer_order_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric NOT NULL,
	"quantity_shipped" numeric DEFAULT '0',
	"quantity_received" numeric DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."transfer_order_picks" (
	"pick_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_order_id" uuid NOT NULL,
	"transfer_order_line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"bin_id" uuid,
	"quantity" numeric NOT NULL,
	"state_code" text DEFAULT 'picked' NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."transfer_order_receipt_lines" (
	"receipt_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"transfer_order_line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"bin_id" uuid NOT NULL,
	"quantity" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."transfer_order_receipts" (
	"receipt_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_order_id" uuid NOT NULL,
	"receipt_number" text NOT NULL,
	"state_code" text DEFAULT 'received' NOT NULL,
	"received_by" text,
	"received_on" timestamp with time zone DEFAULT now(),
	"created_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "transfer_order_receipts_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."transfer_order_shipment_lines" (
	"shipment_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"transfer_order_line_id" uuid NOT NULL,
	"pick_id" uuid,
	"product_id" uuid NOT NULL,
	"quantity" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."transfer_order_shipments" (
	"shipment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_order_id" uuid NOT NULL,
	"shipment_number" text NOT NULL,
	"tracking_number" text,
	"carrier_id" uuid,
	"state_code" text DEFAULT 'dispatched' NOT NULL,
	"shipped_by" text,
	"shipped_on" timestamp with time zone DEFAULT now(),
	"created_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "transfer_order_shipments_shipment_number_unique" UNIQUE("shipment_number")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."transfer_orders" (
	"transfer_order_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"source_location_id" uuid NOT NULL,
	"destination_location_id" uuid NOT NULL,
	"state_code" text DEFAULT 'confirmed' NOT NULL,
	"notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "transfer_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."uom_dictionary" (
	"uom_code" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."user_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text,
	"email" text,
	"role" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."webhooks" (
	"webhook_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_url" text NOT NULL,
	"event_types" jsonb NOT NULL,
	"secret_key" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."zones" (
	"zone_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"source_id" text,
	"source" text DEFAULT 'app' NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "zones_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "zones_code_location_unq" UNIQUE("code","location_id")
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."app_settings" ADD CONSTRAINT "app_settings_default_fulfillment_location_id_locations_location_id_fk" FOREIGN KEY ("default_fulfillment_location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "modbm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "modbm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "modbm_core"."purchase_order_lines"("purchase_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_transfer_order_id_transfer_orders_transfer_order_id_fk" FOREIGN KEY ("transfer_order_id") REFERENCES "modbm_core"."transfer_orders"("transfer_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_transfer_order_line_id_transfer_order_lines_transfer_order_line_id_fk" FOREIGN KEY ("transfer_order_line_id") REFERENCES "modbm_core"."transfer_order_lines"("transfer_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."bin_contents" ADD CONSTRAINT "bin_contents_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "modbm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."bin_contents" ADD CONSTRAINT "bin_contents_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."bins" ADD CONSTRAINT "bins_zone_id_zones_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "modbm_core"."zones"("zone_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."customer_events" ADD CONSTRAINT "customer_events_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "modbm_core"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."customer_groups" ADD CONSTRAINT "customer_groups_default_ar_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_ar_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."customer_groups" ADD CONSTRAINT "customer_groups_default_revenue_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_revenue_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."customer_groups" ADD CONSTRAINT "customer_groups_trading_terms_id_trading_terms_trading_terms_id_fk" FOREIGN KEY ("trading_terms_id") REFERENCES "modbm_core"."trading_terms"("trading_terms_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."customer_groups" ADD CONSTRAINT "customer_groups_default_cost_center_id_cost_centers_cost_center_id_fk" FOREIGN KEY ("default_cost_center_id") REFERENCES "modbm_core"."cost_centers"("cost_center_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."customer_groups" ADD CONSTRAINT "customer_groups_default_activity_id_activities_activity_id_fk" FOREIGN KEY ("default_activity_id") REFERENCES "modbm_core"."activities"("activity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" ADD CONSTRAINT "customers_customer_group_id_customer_groups_customer_group_id_fk" FOREIGN KEY ("customer_group_id") REFERENCES "modbm_core"."customer_groups"("customer_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" ADD CONSTRAINT "customers_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("tax_category_id") REFERENCES "modbm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" ADD CONSTRAINT "customers_trading_terms_id_trading_terms_trading_terms_id_fk" FOREIGN KEY ("trading_terms_id") REFERENCES "modbm_core"."trading_terms"("trading_terms_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."discount_matrix" ADD CONSTRAINT "discount_matrix_customer_group_id_customer_groups_customer_group_id_fk" FOREIGN KEY ("customer_group_id") REFERENCES "modbm_core"."customer_groups"("customer_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."discount_matrix" ADD CONSTRAINT "discount_matrix_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "modbm_core"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."discount_matrix" ADD CONSTRAINT "discount_matrix_product_group_id_product_groups_product_group_id_fk" FOREIGN KEY ("product_group_id") REFERENCES "modbm_core"."product_groups"("product_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_journal_entry_id_gl_journal_entries_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "modbm_core"."gl_journal_entries"("journal_entry_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_reconciliation_id_gl_reconciliations_reconciliation_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "modbm_core"."gl_reconciliations"("reconciliation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_cost_center_id_cost_centers_cost_center_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "modbm_core"."cost_centers"("cost_center_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_activity_id_activities_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "modbm_core"."activities"("activity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_reconciliations" ADD CONSTRAINT "gl_reconciliations_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_ar_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_ar_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_ap_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_ap_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_revenue_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_revenue_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_cogs_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_cogs_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_tax_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_tax_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_expense_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_expense_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_inventory_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_inventory_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_grni_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_grni_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_shrinkage_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_shrinkage_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_fee_revenue_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_fee_revenue_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."goods_received" ADD CONSTRAINT "goods_received_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "modbm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."goods_received" ADD CONSTRAINT "goods_received_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."goods_received_lines" ADD CONSTRAINT "goods_received_lines_goods_received_id_goods_received_goods_received_id_fk" FOREIGN KEY ("goods_received_id") REFERENCES "modbm_core"."goods_received"("goods_received_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."goods_received_lines" ADD CONSTRAINT "goods_received_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."goods_received_lines" ADD CONSTRAINT "goods_received_lines_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "modbm_core"."purchase_order_lines"("purchase_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."goods_received_lines" ADD CONSTRAINT "goods_received_lines_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_entry_id_inventory_entries_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "modbm_core"."inventory_entries"("entry_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "modbm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_zone_id_zones_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "modbm_core"."zones"("zone_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."order_events" ADD CONSTRAINT "order_events_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "modbm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payment_entries_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "modbm_core"."payment_entries"("payment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."payment_entries" ADD CONSTRAINT "payment_entries_gl_account_bank_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_bank") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."payment_events" ADD CONSTRAINT "payment_events_payment_id_payment_entries_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "modbm_core"."payment_entries"("payment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_components" ADD CONSTRAINT "product_components_parent_product_id_products_product_id_fk" FOREIGN KEY ("parent_product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_components" ADD CONSTRAINT "product_components_child_product_id_products_product_id_fk" FOREIGN KEY ("child_product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_default_bins" ADD CONSTRAINT "product_default_bins_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_default_bins" ADD CONSTRAINT "product_default_bins_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_default_bins" ADD CONSTRAINT "product_default_bins_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "modbm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_events" ADD CONSTRAINT "product_events_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_groups" ADD CONSTRAINT "product_groups_default_revenue_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_revenue_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_groups" ADD CONSTRAINT "product_groups_default_expense_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_expense_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_groups" ADD CONSTRAINT "product_groups_default_cost_center_id_cost_centers_cost_center_id_fk" FOREIGN KEY ("default_cost_center_id") REFERENCES "modbm_core"."cost_centers"("cost_center_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_groups" ADD CONSTRAINT "product_groups_default_activity_id_activities_activity_id_fk" FOREIGN KEY ("default_activity_id") REFERENCES "modbm_core"."activities"("activity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_supplier_events" ADD CONSTRAINT "product_supplier_events_product_supplier_id_product_suppliers_product_supplier_id_fk" FOREIGN KEY ("product_supplier_id") REFERENCES "modbm_core"."product_suppliers"("product_supplier_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_suppliers" ADD CONSTRAINT "product_suppliers_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_suppliers" ADD CONSTRAINT "product_suppliers_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "modbm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_uoms" ADD CONSTRAINT "product_uoms_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_uoms" ADD CONSTRAINT "product_uoms_uom_code_uom_dictionary_uom_code_fk" FOREIGN KEY ("uom_code") REFERENCES "modbm_core"."uom_dictionary"("uom_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ADD CONSTRAINT "products_product_group_id_product_groups_product_group_id_fk" FOREIGN KEY ("product_group_id") REFERENCES "modbm_core"."product_groups"("product_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ADD CONSTRAINT "products_base_uom_uom_dictionary_uom_code_fk" FOREIGN KEY ("base_uom") REFERENCES "modbm_core"."uom_dictionary"("uom_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ADD CONSTRAINT "products_purchase_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("purchase_tax_category_id") REFERENCES "modbm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ADD CONSTRAINT "products_sales_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("sales_tax_category_id") REFERENCES "modbm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_debit_note_lines" ADD CONSTRAINT "purchase_debit_note_lines_debit_note_id_purchase_debit_notes_debit_note_id_fk" FOREIGN KEY ("debit_note_id") REFERENCES "modbm_core"."purchase_debit_notes"("debit_note_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_debit_note_lines" ADD CONSTRAINT "purchase_debit_note_lines_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "modbm_core"."purchase_order_lines"("purchase_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_debit_notes" ADD CONSTRAINT "purchase_debit_notes_return_id_purchase_order_returns_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "modbm_core"."purchase_order_returns"("return_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_debit_notes" ADD CONSTRAINT "purchase_debit_notes_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_debit_notes" ADD CONSTRAINT "purchase_debit_notes_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "modbm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_invoice_id_purchase_invoices_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "modbm_core"."purchase_invoices"("invoice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "modbm_core"."purchase_order_lines"("purchase_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoice_receipts" ADD CONSTRAINT "purchase_invoice_receipts_invoice_line_id_purchase_invoice_lines_invoice_line_id_fk" FOREIGN KEY ("invoice_line_id") REFERENCES "modbm_core"."purchase_invoice_lines"("invoice_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoice_receipts" ADD CONSTRAINT "purchase_invoice_receipts_goods_received_line_id_goods_received_lines_goods_received_line_id_fk" FOREIGN KEY ("goods_received_line_id") REFERENCES "modbm_core"."goods_received_lines"("goods_received_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoices" ADD CONSTRAINT "purchase_invoices_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "modbm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoices" ADD CONSTRAINT "purchase_invoices_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_events" ADD CONSTRAINT "purchase_order_events_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("tax_category_id") REFERENCES "modbm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_return_lines" ADD CONSTRAINT "purchase_order_return_lines_return_id_purchase_order_returns_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "modbm_core"."purchase_order_returns"("return_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_return_lines" ADD CONSTRAINT "purchase_order_return_lines_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "modbm_core"."purchase_order_lines"("purchase_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_return_shipment_lines" ADD CONSTRAINT "purchase_order_return_shipment_lines_shipment_id_purchase_order_return_shipments_shipment_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "modbm_core"."purchase_order_return_shipments"("shipment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_return_shipment_lines" ADD CONSTRAINT "purchase_order_return_shipment_lines_return_line_id_purchase_order_return_lines_return_line_id_fk" FOREIGN KEY ("return_line_id") REFERENCES "modbm_core"."purchase_order_return_lines"("return_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_return_shipments" ADD CONSTRAINT "purchase_order_return_shipments_return_id_purchase_order_returns_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "modbm_core"."purchase_order_returns"("return_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_return_shipments" ADD CONSTRAINT "purchase_order_return_shipments_fulfillment_location_id_locations_location_id_fk" FOREIGN KEY ("fulfillment_location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_returns" ADD CONSTRAINT "purchase_order_returns_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "modbm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_orders" ADD CONSTRAINT "purchase_orders_delivery_location_id_locations_location_id_fk" FOREIGN KEY ("delivery_location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."report_contexts" ADD CONSTRAINT "report_contexts_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "modbm_core"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."report_hook_assignments" ADD CONSTRAINT "report_hook_assignments_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "modbm_core"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_credit_note_lines" ADD CONSTRAINT "sales_credit_note_lines_credit_note_id_sales_credit_notes_credit_note_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "modbm_core"."sales_credit_notes"("credit_note_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_credit_note_lines" ADD CONSTRAINT "sales_credit_note_lines_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "modbm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_credit_notes" ADD CONSTRAINT "sales_credit_notes_return_id_sales_order_returns_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "modbm_core"."sales_order_returns"("return_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_credit_notes" ADD CONSTRAINT "sales_credit_notes_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "modbm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_credit_notes" ADD CONSTRAINT "sales_credit_notes_invoice_id_sales_invoices_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "modbm_core"."sales_invoices"("invoice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_invoice_id_sales_invoices_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "modbm_core"."sales_invoices"("invoice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "modbm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_invoices" ADD CONSTRAINT "sales_invoices_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "modbm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "modbm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("tax_category_id") REFERENCES "modbm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_fulfillment_location_id_locations_location_id_fk" FOREIGN KEY ("fulfillment_location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_parent_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("parent_line_id") REFERENCES "modbm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_picks" ADD CONSTRAINT "sales_order_picks_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "modbm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_picks" ADD CONSTRAINT "sales_order_picks_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "modbm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_picks" ADD CONSTRAINT "sales_order_picks_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_picks" ADD CONSTRAINT "sales_order_picks_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "modbm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_return_lines" ADD CONSTRAINT "sales_order_return_lines_return_id_sales_order_returns_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "modbm_core"."sales_order_returns"("return_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_return_lines" ADD CONSTRAINT "sales_order_return_lines_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "modbm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_returns" ADD CONSTRAINT "sales_order_returns_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "modbm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_shipment_lines" ADD CONSTRAINT "sales_order_shipment_lines_shipment_id_sales_order_shipments_shipment_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "modbm_core"."sales_order_shipments"("shipment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_shipment_lines" ADD CONSTRAINT "sales_order_shipment_lines_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "modbm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_shipments" ADD CONSTRAINT "sales_order_shipments_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "modbm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_shipments" ADD CONSTRAINT "sales_order_shipments_fulfillment_location_id_locations_location_id_fk" FOREIGN KEY ("fulfillment_location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_orders" ADD CONSTRAINT "sales_orders_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "modbm_core"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_orders" ADD CONSTRAINT "sales_orders_fulfillment_location_id_locations_location_id_fk" FOREIGN KEY ("fulfillment_location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_sales_order_shipments_shipment_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "modbm_core"."sales_order_shipments"("shipment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_events" ADD CONSTRAINT "supplier_events_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "modbm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_expiries" ADD CONSTRAINT "supplier_expiries_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "modbm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_groups" ADD CONSTRAINT "supplier_groups_default_ap_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_ap_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_groups" ADD CONSTRAINT "supplier_groups_default_expense_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_expense_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_groups" ADD CONSTRAINT "supplier_groups_default_cost_center_id_cost_centers_cost_center_id_fk" FOREIGN KEY ("default_cost_center_id") REFERENCES "modbm_core"."cost_centers"("cost_center_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_groups" ADD CONSTRAINT "supplier_groups_default_activity_id_activities_activity_id_fk" FOREIGN KEY ("default_activity_id") REFERENCES "modbm_core"."activities"("activity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_groups" ADD CONSTRAINT "supplier_groups_trading_terms_id_trading_terms_trading_terms_id_fk" FOREIGN KEY ("trading_terms_id") REFERENCES "modbm_core"."trading_terms"("trading_terms_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD CONSTRAINT "suppliers_supplier_group_id_supplier_groups_supplier_group_id_fk" FOREIGN KEY ("supplier_group_id") REFERENCES "modbm_core"."supplier_groups"("supplier_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD CONSTRAINT "suppliers_trading_terms_id_trading_terms_trading_terms_id_fk" FOREIGN KEY ("trading_terms_id") REFERENCES "modbm_core"."trading_terms"("trading_terms_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_events" ADD CONSTRAINT "transfer_order_events_transfer_order_id_transfer_orders_transfer_order_id_fk" FOREIGN KEY ("transfer_order_id") REFERENCES "modbm_core"."transfer_orders"("transfer_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_lines" ADD CONSTRAINT "transfer_order_lines_transfer_order_id_transfer_orders_transfer_order_id_fk" FOREIGN KEY ("transfer_order_id") REFERENCES "modbm_core"."transfer_orders"("transfer_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_lines" ADD CONSTRAINT "transfer_order_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_picks" ADD CONSTRAINT "transfer_order_picks_transfer_order_id_transfer_orders_transfer_order_id_fk" FOREIGN KEY ("transfer_order_id") REFERENCES "modbm_core"."transfer_orders"("transfer_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_picks" ADD CONSTRAINT "transfer_order_picks_transfer_order_line_id_transfer_order_lines_transfer_order_line_id_fk" FOREIGN KEY ("transfer_order_line_id") REFERENCES "modbm_core"."transfer_order_lines"("transfer_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_picks" ADD CONSTRAINT "transfer_order_picks_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_picks" ADD CONSTRAINT "transfer_order_picks_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "modbm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_receipt_lines" ADD CONSTRAINT "transfer_order_receipt_lines_receipt_id_transfer_order_receipts_receipt_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "modbm_core"."transfer_order_receipts"("receipt_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_receipt_lines" ADD CONSTRAINT "transfer_order_receipt_lines_transfer_order_line_id_transfer_order_lines_transfer_order_line_id_fk" FOREIGN KEY ("transfer_order_line_id") REFERENCES "modbm_core"."transfer_order_lines"("transfer_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_receipt_lines" ADD CONSTRAINT "transfer_order_receipt_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_receipt_lines" ADD CONSTRAINT "transfer_order_receipt_lines_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "modbm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_receipts" ADD CONSTRAINT "transfer_order_receipts_transfer_order_id_transfer_orders_transfer_order_id_fk" FOREIGN KEY ("transfer_order_id") REFERENCES "modbm_core"."transfer_orders"("transfer_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_shipment_lines" ADD CONSTRAINT "transfer_order_shipment_lines_shipment_id_transfer_order_shipments_shipment_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "modbm_core"."transfer_order_shipments"("shipment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_shipment_lines" ADD CONSTRAINT "transfer_order_shipment_lines_transfer_order_line_id_transfer_order_lines_transfer_order_line_id_fk" FOREIGN KEY ("transfer_order_line_id") REFERENCES "modbm_core"."transfer_order_lines"("transfer_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_shipment_lines" ADD CONSTRAINT "transfer_order_shipment_lines_pick_id_transfer_order_picks_pick_id_fk" FOREIGN KEY ("pick_id") REFERENCES "modbm_core"."transfer_order_picks"("pick_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_shipment_lines" ADD CONSTRAINT "transfer_order_shipment_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_shipments" ADD CONSTRAINT "transfer_order_shipments_transfer_order_id_transfer_orders_transfer_order_id_fk" FOREIGN KEY ("transfer_order_id") REFERENCES "modbm_core"."transfer_orders"("transfer_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_orders" ADD CONSTRAINT "transfer_orders_source_location_id_locations_location_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_orders" ADD CONSTRAINT "transfer_orders_destination_location_id_locations_location_id_fk" FOREIGN KEY ("destination_location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."user_events" ADD CONSTRAINT "user_events_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "modbm_core"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."zones" ADD CONSTRAINT "zones_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_backorders_sol_state" ON "modbm_core"."backorders" USING btree ("sales_order_line_id","state_code");--> statement-breakpoint
CREATE INDEX "idx_backorders_product" ON "modbm_core"."backorders" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_discount_matrix_customer_group" ON "modbm_core"."discount_matrix" USING btree ("customer_group_id");--> statement-breakpoint
CREATE INDEX "idx_discount_matrix_customer" ON "modbm_core"."discount_matrix" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_ledger_product_location" ON "modbm_core"."inventory_ledger" USING btree ("product_id","location_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_order_lines_product" ON "modbm_core"."purchase_order_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_orders_delivery_location" ON "modbm_core"."purchase_orders" USING btree ("delivery_location_id");--> statement-breakpoint
CREATE INDEX "idx_sales_order_lines_product_location" ON "modbm_core"."sales_order_lines" USING btree ("product_id","fulfillment_location_id");--> statement-breakpoint
CREATE INDEX "idx_sales_order_picks_order" ON "modbm_core"."sales_order_picks" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "idx_sales_order_picks_line" ON "modbm_core"."sales_order_picks" USING btree ("sales_order_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_categories_single_default_idx" ON "modbm_core"."tax_categories" USING btree ("is_default") WHERE "modbm_core"."tax_categories"."is_default" = true;--> statement-breakpoint
CREATE INDEX "idx_transfer_order_lines_product" ON "modbm_core"."transfer_order_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_order_picks_order" ON "modbm_core"."transfer_order_picks" USING btree ("transfer_order_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_order_picks_line" ON "modbm_core"."transfer_order_picks" USING btree ("transfer_order_line_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_order_receipt_lines_receipt" ON "modbm_core"."transfer_order_receipt_lines" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_order_receipts_order" ON "modbm_core"."transfer_order_receipts" USING btree ("transfer_order_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_order_shipment_lines_shipment" ON "modbm_core"."transfer_order_shipment_lines" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_order_shipments_order" ON "modbm_core"."transfer_order_shipments" USING btree ("transfer_order_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_orders_source_location" ON "modbm_core"."transfer_orders" USING btree ("source_location_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_orders_dest_location" ON "modbm_core"."transfer_orders" USING btree ("destination_location_id");
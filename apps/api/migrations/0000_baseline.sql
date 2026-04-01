CREATE SCHEMA IF NOT EXISTS "modbm_core";
--> statement-breakpoint
CREATE TABLE "modbm_core"."account_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."account_groups" (
	"account_group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_code" text NOT NULL,
	"name" text NOT NULL,
	"default_discount_percentage" numeric DEFAULT '0',
	"default_ar_account_id" uuid,
	"default_revenue_account_id" uuid,
	CONSTRAINT "account_groups_group_code_unique" UNIQUE("group_code")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."accounts" (
	"account_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_number" text NOT NULL,
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
	"account_group_id" uuid,
	"state_code" text DEFAULT 'active' NOT NULL,
	"gst_category_id" uuid,
	"currency_code" text DEFAULT 'EUR' NOT NULL,
	"customer_discount" numeric DEFAULT '0',
	"erpnext_id" text,
	"source_id" text,
	"source" text DEFAULT 'app' NOT NULL,
	"price_tier" text,
	"notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "accounts_account_number_unique" UNIQUE("account_number"),
	CONSTRAINT "accounts_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "accounts_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'))
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."backorders" (
	"backorder_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"purchase_order_line_id" uuid,
	"quantity" numeric NOT NULL,
	"state_code" text DEFAULT 'pending_supply' NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
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
	"bin_type" text,
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
	"currency_code" text DEFAULT 'AUD' NOT NULL,
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
	"memo" text
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."gl_settings" (
	"settings_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_start_month" integer DEFAULT 7 NOT NULL,
	"default_ar_account_id" uuid,
	"default_ap_account_id" uuid,
	"default_revenue_account_id" uuid,
	"default_cogs_account_id" uuid,
	"default_tax_account_id" uuid,
	"default_expense_account_id" uuid,
	"base_currency" text DEFAULT 'AUD' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."gst_categories" (
	"gst_category_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"rate" numeric DEFAULT '0',
	"is_default" boolean DEFAULT false,
	CONSTRAINT "gst_categories_code_unique" UNIQUE("code")
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
	"product_type" text DEFAULT 'inventory' NOT NULL,
	"product_group_id" uuid,
	"barcode" text,
	"list_price" numeric(12, 2) DEFAULT '0',
	"standard_cost" numeric(12, 2) DEFAULT '0',
	"trade_price" numeric(12, 2) DEFAULT '0',
	"price_level_3" numeric(12, 2) DEFAULT '0',
	"price_level_4" numeric(12, 2) DEFAULT '0',
	"weighted_average_cost" numeric DEFAULT '0',
	"quantity_on_hand" numeric DEFAULT '0',
	"base_uom" text DEFAULT 'EA' NOT NULL,
	"default_sales_uom_id" uuid,
	"default_purchase_uom_id" uuid,
	"gst_category_id" uuid,
	"sc_number" text,
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
CREATE TABLE "modbm_core"."purchase_invoice_lines" (
	"invoice_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"quantity_invoiced" numeric NOT NULL,
	"price_per_unit" numeric NOT NULL,
	"amount" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_invoices" (
	"invoice_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"supplier_invoice_number" text,
	"erpnext_journal_id" text,
	"total_amount" numeric NOT NULL,
	"tax_amount" numeric DEFAULT '0',
	"currency_code" text DEFAULT 'EUR' NOT NULL,
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
	"tax" numeric DEFAULT '0',
	"total_amount" numeric,
	"unit_of_measure" text,
	"quantity_received" numeric DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_order_reception_lines" (
	"reception_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reception_id" uuid NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"quantity_received" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_order_receptions" (
	"reception_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reception_number" text NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"state_code" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"packing_slip_number" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "purchase_order_receptions_reception_number_unique" UNIQUE("reception_number")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_orders" (
	"purchase_order_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"name" text,
	"vendor_id" uuid,
	"delivery_location_id" uuid,
	"invoice_number" text,
	"state_code" text DEFAULT 'draft' NOT NULL,
	"currency_code" text DEFAULT 'EUR' NOT NULL,
	"notes" text,
	"custom_fields" jsonb,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "purchase_orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "purchase_orders_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'))
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
	"erpnext_journal_id" text,
	"total_amount" numeric NOT NULL,
	"tax_amount" numeric DEFAULT '0',
	"currency_code" text DEFAULT 'EUR' NOT NULL,
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
	"gst_category_id" uuid,
	"tax" numeric DEFAULT '0',
	"total_amount" numeric,
	"unit_of_measure" text,
	"quantity_picked" numeric DEFAULT '0',
	"fulfillment_location_id" uuid NOT NULL,
	"is_post_confirmation" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."sales_order_return_lines" (
	"return_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"quantity_returned" numeric NOT NULL,
	"reason" text,
	"return_fee" numeric DEFAULT '0'
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
	CONSTRAINT "sales_order_returns_return_number_unique" UNIQUE("return_number")
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
	"state_code" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"tracking_number" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sales_order_shipments_shipment_number_unique" UNIQUE("shipment_number")
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
	"currency_code" text DEFAULT 'EUR' NOT NULL,
	"notes" text,
	"custom_fields" jsonb,
	"source_id" text,
	"source" text DEFAULT 'app' NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sales_orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "sales_orders_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "sales_orders_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'))
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
CREATE TABLE "modbm_core"."supplier_groups" (
	"supplier_group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_code" text NOT NULL,
	"name" text NOT NULL,
	"default_discount_percentage" numeric DEFAULT '0',
	"default_ap_account_id" uuid,
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
	"payment_terms" text,
	"currency_code" text DEFAULT 'EUR' NOT NULL,
	"state_code" text DEFAULT 'active' NOT NULL,
	"erpnext_id" text,
	"notes" text,
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
CREATE TABLE "modbm_core"."uom_dictionary" (
	"uom_code" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
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
ALTER TABLE "modbm_core"."account_events" ADD CONSTRAINT "account_events_account_id_accounts_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "modbm_core"."accounts"("account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."account_groups" ADD CONSTRAINT "account_groups_default_ar_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_ar_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."account_groups" ADD CONSTRAINT "account_groups_default_revenue_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_revenue_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."accounts" ADD CONSTRAINT "accounts_account_group_id_account_groups_account_group_id_fk" FOREIGN KEY ("account_group_id") REFERENCES "modbm_core"."account_groups"("account_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."accounts" ADD CONSTRAINT "accounts_gst_category_id_gst_categories_gst_category_id_fk" FOREIGN KEY ("gst_category_id") REFERENCES "modbm_core"."gst_categories"("gst_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "modbm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "modbm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "modbm_core"."purchase_order_lines"("purchase_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."bin_contents" ADD CONSTRAINT "bin_contents_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "modbm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."bin_contents" ADD CONSTRAINT "bin_contents_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."bins" ADD CONSTRAINT "bins_zone_id_zones_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "modbm_core"."zones"("zone_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_journal_entry_id_gl_journal_entries_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "modbm_core"."gl_journal_entries"("journal_entry_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_ar_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_ar_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_ap_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_ap_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_revenue_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_revenue_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_cogs_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_cogs_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_tax_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_tax_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_expense_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_expense_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_entry_id_inventory_entries_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "modbm_core"."inventory_entries"("entry_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "modbm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_zone_id_zones_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "modbm_core"."zones"("zone_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."order_events" ADD CONSTRAINT "order_events_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "modbm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_events" ADD CONSTRAINT "product_events_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_groups" ADD CONSTRAINT "product_groups_default_revenue_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_revenue_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_groups" ADD CONSTRAINT "product_groups_default_expense_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_expense_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_supplier_events" ADD CONSTRAINT "product_supplier_events_product_supplier_id_product_suppliers_product_supplier_id_fk" FOREIGN KEY ("product_supplier_id") REFERENCES "modbm_core"."product_suppliers"("product_supplier_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_suppliers" ADD CONSTRAINT "product_suppliers_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_suppliers" ADD CONSTRAINT "product_suppliers_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "modbm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_uoms" ADD CONSTRAINT "product_uoms_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_uoms" ADD CONSTRAINT "product_uoms_uom_code_uom_dictionary_uom_code_fk" FOREIGN KEY ("uom_code") REFERENCES "modbm_core"."uom_dictionary"("uom_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ADD CONSTRAINT "products_product_group_id_product_groups_product_group_id_fk" FOREIGN KEY ("product_group_id") REFERENCES "modbm_core"."product_groups"("product_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ADD CONSTRAINT "products_base_uom_uom_dictionary_uom_code_fk" FOREIGN KEY ("base_uom") REFERENCES "modbm_core"."uom_dictionary"("uom_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ADD CONSTRAINT "products_gst_category_id_gst_categories_gst_category_id_fk" FOREIGN KEY ("gst_category_id") REFERENCES "modbm_core"."gst_categories"("gst_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_invoice_id_purchase_invoices_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "modbm_core"."purchase_invoices"("invoice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "modbm_core"."purchase_order_lines"("purchase_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoices" ADD CONSTRAINT "purchase_invoices_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_events" ADD CONSTRAINT "purchase_order_events_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_reception_lines" ADD CONSTRAINT "purchase_order_reception_lines_reception_id_purchase_order_receptions_reception_id_fk" FOREIGN KEY ("reception_id") REFERENCES "modbm_core"."purchase_order_receptions"("reception_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_reception_lines" ADD CONSTRAINT "purchase_order_reception_lines_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "modbm_core"."purchase_order_lines"("purchase_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_receptions" ADD CONSTRAINT "purchase_order_receptions_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "modbm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_orders" ADD CONSTRAINT "purchase_orders_delivery_location_id_locations_location_id_fk" FOREIGN KEY ("delivery_location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."report_contexts" ADD CONSTRAINT "report_contexts_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "modbm_core"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."report_hook_assignments" ADD CONSTRAINT "report_hook_assignments_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "modbm_core"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_invoice_id_sales_invoices_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "modbm_core"."sales_invoices"("invoice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "modbm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_invoices" ADD CONSTRAINT "sales_invoices_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "modbm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "modbm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_gst_category_id_gst_categories_gst_category_id_fk" FOREIGN KEY ("gst_category_id") REFERENCES "modbm_core"."gst_categories"("gst_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_fulfillment_location_id_locations_location_id_fk" FOREIGN KEY ("fulfillment_location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_return_lines" ADD CONSTRAINT "sales_order_return_lines_return_id_sales_order_returns_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "modbm_core"."sales_order_returns"("return_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_return_lines" ADD CONSTRAINT "sales_order_return_lines_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "modbm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_returns" ADD CONSTRAINT "sales_order_returns_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "modbm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_shipment_lines" ADD CONSTRAINT "sales_order_shipment_lines_shipment_id_sales_order_shipments_shipment_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "modbm_core"."sales_order_shipments"("shipment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_shipment_lines" ADD CONSTRAINT "sales_order_shipment_lines_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "modbm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_shipments" ADD CONSTRAINT "sales_order_shipments_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "modbm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_orders" ADD CONSTRAINT "sales_orders_customer_id_accounts_account_id_fk" FOREIGN KEY ("customer_id") REFERENCES "modbm_core"."accounts"("account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_orders" ADD CONSTRAINT "sales_orders_fulfillment_location_id_locations_location_id_fk" FOREIGN KEY ("fulfillment_location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_events" ADD CONSTRAINT "supplier_events_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "modbm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_groups" ADD CONSTRAINT "supplier_groups_default_ap_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_ap_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD CONSTRAINT "suppliers_supplier_group_id_supplier_groups_supplier_group_id_fk" FOREIGN KEY ("supplier_group_id") REFERENCES "modbm_core"."supplier_groups"("supplier_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."zones" ADD CONSTRAINT "zones_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gst_categories_single_default_idx" ON "modbm_core"."gst_categories" USING btree ("is_default") WHERE "modbm_core"."gst_categories"."is_default" = true;
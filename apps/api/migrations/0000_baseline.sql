CREATE SCHEMA IF NOT EXISTS "herobm_core";
--> statement-breakpoint
CREATE TYPE "herobm_core"."bin_type_enum" AS ENUM('storage', 'pick', 'bulk', 'staging', 'quarantine', 'in_transit', 'wip');--> statement-breakpoint
CREATE TYPE "herobm_core"."email_status" AS ENUM('pending', 'sending', 'sent', 'failed', 'dismissed');--> statement-breakpoint
CREATE TYPE "herobm_core"."fractional_behavior" AS ENUM('allow_fractional', 'round_up', 'round_down', 'force_multiple');--> statement-breakpoint
CREATE TYPE "herobm_core"."product_structure" AS ENUM('standard', 'kit');--> statement-breakpoint
CREATE TYPE "herobm_core"."product_type" AS ENUM('inventory', 'non-stock', 'service', 'freight');--> statement-breakpoint
CREATE TABLE "herobm_core"."activities" (
	"activity_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean NOT NULL,
	"is_active" boolean NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "activities_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."actor_actor_links" (
	"link_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_actor_id" uuid NOT NULL,
	"target_actor_id" uuid NOT NULL,
	"link_type" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."actor_contact_links" (
	"link_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"link_type" text NOT NULL,
	"primary_for" text[],
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."actor_notes" (
	"note_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_by_id" uuid,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."actors" (
	"actor_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_code" text NOT NULL,
	"name" text NOT NULL,
	"legal_status" text,
	"headquarters_address_line1" text,
	"headquarters_address_line2" text,
	"headquarters_city" text,
	"headquarters_state_or_province" text,
	"headquarters_postal_code" text,
	"headquarters_country" text,
	"website" text,
	"industry" text,
	"telephone" text,
	"fax" text,
	"email" text,
	"business_number" text,
	"is_tax_registered" boolean NOT NULL,
	"referral_mode" text,
	"referred_by_actor_id" uuid,
	"referred_by_contact_id" uuid,
	"referral_note" text,
	"tags" text[],
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."api_keys" (
	"api_key_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"role" text NOT NULL,
	"is_active" boolean NOT NULL,
	"created_by" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."app_settings" (
	"settings_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"default_fulfillment_location_id" uuid,
	"default_customer_terms_id" uuid,
	"default_supplier_terms_id" uuid,
	"default_customer_tax_position_id" uuid,
	"default_supplier_tax_position_id" uuid,
	"default_purchase_tax_category_id" uuid,
	"default_sales_tax_category_id" uuid,
	"inventory_valuation_method" text NOT NULL,
	"inventory_accounting_mode" text NOT NULL,
	"credit_limit_behavior" text NOT NULL,
	"smtp_host" text,
	"smtp_port" integer,
	"smtp_user" text,
	"smtp_pass_encrypted" text,
	"smtp_from_address" text,
	"actor_tags" jsonb,
	"actor_contact_roles" jsonb,
	"project_contact_roles" jsonb,
	"project_actor_roles" jsonb,
	"project_statuses" jsonb,
	"project_types" jsonb,
	"referral_modes" jsonb,
	"sales_analysis_codes" jsonb,
	"api_rate_limit" numeric NOT NULL,
	"setup_completed_at" timestamp with time zone,
	"system_identifier" text,
	"active_license_key" text,
	"active_license_payload" jsonb,
	"tax_provider_mappings" jsonb,
	"enrichment_provider_mappings" jsonb
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."backorders" (
	"backorder_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_id" uuid,
	"sales_order_line_id" uuid,
	"demand_work_order_id" uuid,
	"work_order_component_id" uuid,
	"product_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"purchase_order_line_id" uuid,
	"transfer_order_id" uuid,
	"transfer_order_line_id" uuid,
	"work_order_id" uuid,
	"quantity" numeric NOT NULL,
	"state_code" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."bank_statement_lines" (
	"line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gl_account_id" uuid NOT NULL,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"amount" numeric NOT NULL,
	"reference" text,
	"type" text,
	"payee" text,
	"is_reconciled" boolean NOT NULL,
	"reconciliation_id" uuid,
	"matched_journal_line_id" uuid,
	"match_group_id" uuid,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."bin_contents" (
	"bin_content_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bin_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"actual_quantity" numeric NOT NULL,
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "bin_contents_bin_product_unq" UNIQUE("bin_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."bins" (
	"bin_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bin_number" text NOT NULL,
	"zone_id" uuid NOT NULL,
	"bin_type" "herobm_core"."bin_type_enum" NOT NULL,
	"is_consignment" boolean,
	"is_bonded" boolean,
	"is_unavailable" boolean,
	"source_id" text,
	"source" text NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "bins_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "bins_bin_number_zone_unq" UNIQUE("bin_number","zone_id")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."business_report_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_display_name" text,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."business_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"data_source_hook" text NOT NULL,
	"ui_config" jsonb NOT NULL,
	"is_system" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_reports_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."casbin_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ptype" text NOT NULL,
	"v0" text,
	"v1" text,
	"v2" text,
	"v3" text,
	"v4" text,
	"v5" text
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."contacts" (
	"contact_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_code" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"full_name" text,
	"job_title" text,
	"email" text,
	"phone" text,
	"mobile" text,
	"linkedin_profile" text,
	"referred_by_actor_id" uuid,
	"referred_by_contact_id" uuid,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."cost_centers" (
	"cost_center_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean NOT NULL,
	"is_active" boolean NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "cost_centers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."csv_mapping_profiles" (
	"profile_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"date_column" text NOT NULL,
	"amount_column" text,
	"debit_column" text,
	"credit_column" text,
	"description_column" text NOT NULL,
	"type_column" text,
	"payee_column" text,
	"reference_column" text,
	"header_rows" integer NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."customer_delivery_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"address_name" text,
	"company_name" text,
	"recipient_name" text,
	"recipient_phone" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state_or_province" text,
	"postal_code" text,
	"country" text,
	"is_primary" boolean NOT NULL,
	"source_id" text,
	"source" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."customer_groups" (
	"customer_group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_code" text NOT NULL,
	"name" text NOT NULL,
	"state_code" text NOT NULL,
	"default_ar_account_id" uuid,
	"default_revenue_account_id" uuid,
	"trading_terms_id" uuid,
	"default_cost_center_id" uuid,
	"default_activity_id" uuid,
	"early_payment_discount" numeric,
	"early_payment_discount_days" integer,
	"credit_limit" numeric,
	"is_on_credit_hold" boolean NOT NULL,
	"tax_position_id" uuid,
	CONSTRAINT "customer_groups_group_code_unique" UNIQUE("group_code")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."customers" (
	"customer_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_number" text NOT NULL,
	"customer_group_id" uuid,
	"actor_id" uuid,
	"state_code" text NOT NULL,
	"tax_position_id" uuid,
	"currency_code" text NOT NULL,
	"trading_terms_id" uuid,
	"early_payment_discount" numeric,
	"early_payment_discount_days" integer,
	"credit_limit" numeric,
	"is_on_credit_hold" boolean,
	"override_credit_hold_until" timestamp with time zone,
	"bank_account_name" text,
	"bank_bsb" text,
	"bank_account_number" text,
	"external_id" text,
	"source_id" text,
	"source" text NOT NULL,
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
CREATE TABLE "herobm_core"."discount_matrix" (
	"discount_matrix_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_group_id" uuid,
	"customer_id" uuid,
	"product_group_id" uuid,
	"discount_percentage" numeric NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "discount_matrix_group_product_unq" UNIQUE("customer_group_id","product_group_id"),
	CONSTRAINT "discount_matrix_customer_product_unq" UNIQUE("customer_id","product_group_id"),
	CONSTRAINT "discount_matrix_owner_check" CHECK ((customer_group_id IS NOT NULL AND customer_id IS NULL) OR
          (customer_group_id IS NULL AND customer_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."email_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_display_name" text,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"to_address" text NOT NULL,
	"reply_to" text,
	"subject" text NOT NULL,
	"html_body" text NOT NULL,
	"attachments" jsonb,
	"status" "herobm_core"."email_status" NOT NULL,
	"retries" integer NOT NULL,
	"last_error" text,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."exchange_rates" (
	"exchange_rate_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"currency_code" text NOT NULL,
	"currency_name" text NOT NULL,
	"buy_rate" numeric NOT NULL,
	"sell_rate" numeric NOT NULL,
	"effective_date" timestamp DEFAULT now(),
	"updated_on" timestamp DEFAULT now(),
	CONSTRAINT "exchange_rates_currency_effective_date_unq" UNIQUE("currency_code","effective_date"),
	CONSTRAINT "exchange_rates_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'))
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."financial_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_display_name" text,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."gl_accounts" (
	"gl_account_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_code" text NOT NULL,
	"name" text NOT NULL,
	"account_type" text NOT NULL,
	"parent_account_id" uuid,
	"is_group" boolean NOT NULL,
	"is_system" boolean NOT NULL,
	"is_bank_account" boolean NOT NULL,
	"currency_code" text NOT NULL,
	"metadata" jsonb,
	"is_active" boolean NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "gl_accounts_account_code_unique" UNIQUE("account_code"),
	CONSTRAINT "gl_accounts_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'))
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."gl_journal_entries" (
	"journal_entry_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_number" integer,
	"entry_number" text NOT NULL,
	"entry_date" date NOT NULL,
	"memo" text,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"prev_hash" text,
	"entry_hash" text,
	"is_reversed" boolean NOT NULL,
	"reversed_by" uuid,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "gl_journal_entries_entry_number_unique" UNIQUE("entry_number")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."gl_journal_lines" (
	"journal_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"gl_account_id" uuid NOT NULL,
	"party_type" text,
	"party_id" text,
	"debit" numeric NOT NULL,
	"credit" numeric NOT NULL,
	"foreign_debit" numeric NOT NULL,
	"foreign_credit" numeric NOT NULL,
	"foreign_currency_code" text,
	"exchange_rate" numeric,
	"memo" text,
	"is_reconciled" boolean NOT NULL,
	"reconciliation_id" uuid,
	"cost_center_id" uuid,
	"activity_id" uuid,
	"match_group_id" uuid
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."gl_match_groups" (
	"match_group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_type" text NOT NULL,
	"rule_id" uuid,
	"created_by" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."gl_reconciliations" (
	"reconciliation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gl_account_id" uuid NOT NULL,
	"statement_date" date NOT NULL,
	"statement_balance" numeric NOT NULL,
	"status" text NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"posted_on" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."gl_settings" (
	"settings_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_metadata_schema" jsonb,
	"fiscal_year_start_month" integer NOT NULL,
	"bank_match_date_tolerance_days" integer NOT NULL,
	"default_ar_account_id" uuid,
	"default_ap_account_id" uuid,
	"default_revenue_account_id" uuid,
	"default_cogs_account_id" uuid,
	"default_sales_tax_account_id" uuid,
	"default_purchase_tax_account_id" uuid,
	"default_expense_account_id" uuid,
	"default_inventory_account_id" uuid,
	"default_grni_account_id" uuid,
	"realised_fx_gain_account_id" uuid,
	"realised_fx_loss_account_id" uuid,
	"unrealised_fx_gain_account_id" uuid,
	"unrealised_fx_loss_account_id" uuid,
	"default_shrinkage_account_id" uuid,
	"default_ppv_account_id" uuid,
	"default_cost_center_id" uuid,
	"default_activity_id" uuid,
	"base_currency" text NOT NULL,
	"supported_batch_payment_formats" jsonb,
	"revenue_routing_precedence" text NOT NULL,
	"expense_routing_precedence" text NOT NULL,
	"default_fee_revenue_account_id" uuid,
	"default_discounts_received_account_id" uuid,
	"default_discounts_given_account_id" uuid,
	"default_otc_cash_account_id" uuid,
	"default_otc_card_account_id" uuid
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."goods_received" (
	"goods_received_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_number" text NOT NULL,
	"vendor_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"packing_slip_number" text,
	"notes" text,
	"state_code" text NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "goods_received_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."goods_received_lines" (
	"goods_received_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goods_received_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity_received" numeric NOT NULL,
	"unit_cost" numeric,
	"match_status" text NOT NULL,
	"putaway_status" text NOT NULL,
	"purchase_order_line_id" uuid,
	"purchase_order_id" uuid
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."group_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_display_name" text,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."integration_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_display_name" text,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."integrations" (
	"integration_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"config" jsonb NOT NULL,
	"is_active" boolean NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "integrations_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."inventory_entries" (
	"entry_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_number" text NOT NULL,
	"entry_date" timestamp with time zone DEFAULT now() NOT NULL,
	"memo" text,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"is_reversed" boolean NOT NULL,
	"reversed_by" uuid,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "inventory_entries_entry_number_unique" UNIQUE("entry_number")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."inventory_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_display_name" text,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."inventory_ledger" (
	"ledger_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"bin_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"quantity" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."locations" (
	"location_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address_line_1" text,
	"address_line_2" text,
	"city" text,
	"state_or_province" text,
	"country" text,
	"postal_code" text,
	"source_id" text,
	"source" text NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "locations_code_unique" UNIQUE("code"),
	CONSTRAINT "locations_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."macros" (
	"macro_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"macro_type" text NOT NULL,
	"content" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "macros_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."master_data_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_display_name" text,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."organization" (
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
CREATE TABLE "herobm_core"."outbox" (
	"outbox_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_display_name" text,
	"payload" jsonb,
	"created_on" timestamp with time zone DEFAULT now(),
	"processed_at" timestamp with time zone,
	"locked_until" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."payment_allocations" (
	"allocation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" uuid NOT NULL,
	"allocated_amount" numeric NOT NULL,
	"discount_amount" numeric,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."payment_entries" (
	"payment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_number" text NOT NULL,
	"payment_type" text NOT NULL,
	"party_id" uuid,
	"payment_date" timestamp with time zone NOT NULL,
	"mode_of_payment" text NOT NULL,
	"total_amount" numeric NOT NULL,
	"unallocated_amount" numeric NOT NULL,
	"gl_account_bank" uuid NOT NULL,
	"reference_number" text,
	"state_code" text NOT NULL,
	"base_total_amount" numeric,
	"base_unallocated_amount" numeric,
	"currency_code" text NOT NULL,
	"exchange_rate" numeric NOT NULL,
	"created_by" text,
	"aba_exported_at" timestamp with time zone,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "payment_entries_payment_number_unique" UNIQUE("payment_number")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."payment_lines" (
	"payment_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"gl_account_id" uuid NOT NULL,
	"amount" numeric NOT NULL,
	"memo" text
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."pdf_template_contexts" (
	"template_id" uuid NOT NULL,
	"context" text NOT NULL,
	CONSTRAINT "pdf_template_contexts_template_id_context_pk" PRIMARY KEY("template_id","context")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."pdf_template_hooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hook_slug" text NOT NULL,
	"report_id" uuid NOT NULL,
	"context_slug" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pdf_template_hooks_hook_slug_unique" UNIQUE("hook_slug")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."pdf_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"template" text NOT NULL,
	"mock_data" jsonb,
	"context_resolver" text,
	"output_name_pattern" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pdf_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."_pipeline_jobs" (
	"job_id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"config_json" jsonb,
	"progress_json" jsonb,
	"logs_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."procurement_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_display_name" text,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."product_components" (
	"component_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_product_id" uuid NOT NULL,
	"child_product_id" uuid NOT NULL,
	"parent_quantity" numeric(14, 4) NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"sequence_number" integer,
	"fractional_behavior" "herobm_core"."fractional_behavior"
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."product_default_bins" (
	"product_default_bin_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"bin_id" uuid NOT NULL,
	"is_primary_per_loc" boolean NOT NULL,
	"min_quantity" numeric,
	"max_quantity" numeric,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "product_default_bins_prod_loc_bin_unq" UNIQUE("product_id","location_id","bin_id")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."product_groups" (
	"product_group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_code" text NOT NULL,
	"name" text NOT NULL,
	"default_revenue_account_id" uuid,
	"default_expense_account_id" uuid,
	"default_cost_center_id" uuid,
	"default_activity_id" uuid,
	"purchase_tax_category_id" uuid,
	"sales_tax_category_id" uuid,
	CONSTRAINT "product_groups_group_code_unique" UNIQUE("group_code")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."product_suppliers" (
	"product_supplier_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"supplier_part_number" text,
	"cost_price" numeric,
	"discount_percent" numeric,
	"price_break_quantity" numeric,
	"is_preferred" boolean NOT NULL,
	"min_purchase_qty" numeric,
	"purchase_unit" text,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"state_code" text NOT NULL,
	"source_id" text,
	"source" text NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "product_suppliers_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "product_suppliers_supplier_product_unq" UNIQUE("vendor_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."product_uoms" (
	"product_uom_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"uom_code" text NOT NULL,
	"ratio" numeric(12, 4) NOT NULL,
	"barcode" text,
	"is_sales_default" boolean,
	"is_purchase_default" boolean,
	CONSTRAINT "product_uoms_product_code_unq" UNIQUE("product_id","uom_code")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."products" (
	"product_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_number" text NOT NULL,
	"name" text NOT NULL,
	"product_type" "herobm_core"."product_type" NOT NULL,
	"structure_type" "herobm_core"."product_structure" NOT NULL,
	"product_group_id" uuid,
	"barcode" text,
	"list_price" numeric(12, 2),
	"standard_cost" numeric(12, 2),
	"trade_price" numeric(12, 2),
	"price_level_3" numeric(12, 2),
	"price_level_4" numeric(12, 2),
	"weighted_average_cost" numeric,
	"weight" numeric(12, 4),
	"alternate_invoice_description" text,
	"box_quantity" numeric,
	"base_uom" text NOT NULL,
	"default_sales_uom_id" uuid,
	"default_purchase_uom_id" uuid,
	"purchase_tax_category_id" uuid,
	"sales_tax_category_id" uuid,
	"external_tax_code" text,
	"alternate_product_number" text,
	"image_path" text,
	"state_code" text NOT NULL,
	"notes" text,
	"source_id" text,
	"source" text NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "products_product_number_unique" UNIQUE("product_number"),
	CONSTRAINT "products_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."project_actors" (
	"project_actor_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"roles" text[],
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."project_contacts" (
	"project_contact_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"roles" text[],
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."project_notes" (
	"note_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_by_id" uuid,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."projects" (
	"project_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_code" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"type" text NOT NULL,
	"owner_id" uuid,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."purchase_debit_note_lines" (
	"debit_note_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_id" uuid NOT NULL,
	"purchase_order_line_id" uuid,
	"description" text,
	"account_id" uuid,
	"tax_category_id" uuid,
	"quantity_invoiced" numeric NOT NULL,
	"price_per_unit" numeric NOT NULL,
	"amount" numeric NOT NULL,
	"tax_amount" numeric
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."purchase_debit_notes" (
	"debit_note_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_number" text NOT NULL,
	"supplier_reference_number" text,
	"return_id" uuid,
	"purchase_order_id" uuid,
	"vendor_id" uuid NOT NULL,
	"total_amount" numeric NOT NULL,
	"tax_amount" numeric,
	"fee_amount" numeric,
	"outstanding_amount" numeric NOT NULL,
	"base_total_amount" numeric,
	"base_outstanding_amount" numeric,
	"currency_code" text NOT NULL,
	"exchange_rate" numeric NOT NULL,
	"state_code" text NOT NULL,
	"notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "purchase_debit_notes_debit_note_number_unique" UNIQUE("debit_note_number"),
	CONSTRAINT "purchase_debit_notes_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR')),
	CONSTRAINT "purchase_debit_note_state_check" CHECK (state_code IN ('draft', 'posted', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."purchase_invoice_lines" (
	"invoice_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"purchase_order_line_id" uuid,
	"product_id" uuid,
	"gl_account_id" uuid,
	"description" text,
	"quantity_invoiced" numeric NOT NULL,
	"price_per_unit" numeric NOT NULL,
	"amount" numeric NOT NULL,
	"match_status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."purchase_invoice_receipts" (
	"invoice_receipt_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_line_id" uuid NOT NULL,
	"goods_received_line_id" uuid NOT NULL,
	"quantity_billed" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."purchase_invoices" (
	"invoice_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"vendor_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"supplier_invoice_number" text,
	"receipt_filename" text,
	"total_amount" numeric NOT NULL,
	"outstanding_amount" numeric NOT NULL,
	"tax_amount" numeric,
	"base_total_amount" numeric,
	"base_outstanding_amount" numeric,
	"currency_code" text NOT NULL,
	"exchange_rate" numeric NOT NULL,
	"state_code" text NOT NULL,
	"invoice_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"terms_description" text,
	"notes" text,
	"early_payment_discount" numeric,
	"early_payment_discount_days" integer,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "purchase_invoices_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "purchase_invoices_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'))
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."purchase_order_lines" (
	"purchase_order_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"line_type" text,
	"product_id" uuid,
	"product_description" text,
	"quantity" numeric NOT NULL,
	"price_per_unit" numeric NOT NULL,
	"discount_percentage" numeric,
	"amount" numeric,
	"tax_category_id" uuid,
	"tax" numeric,
	"total_amount" numeric,
	"unit_of_measure" text,
	"quantity_received" numeric,
	CONSTRAINT "purchase_order_lines_product_check" CHECK ((line_type = 'Product' AND tax_category_id IS NOT NULL) OR line_type = 'Comment')
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."purchase_order_return_lines" (
	"return_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"quantity_returned" numeric NOT NULL,
	"reason" text,
	"return_fee" numeric,
	"source_bin_id" uuid
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."purchase_order_return_shipment_lines" (
	"shipment_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"return_line_id" uuid NOT NULL,
	"quantity_shipped" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."purchase_order_return_shipments" (
	"shipment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_number" text NOT NULL,
	"return_id" uuid NOT NULL,
	"state_code" text NOT NULL,
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
CREATE TABLE "herobm_core"."purchase_order_returns" (
	"return_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_number" text NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"state_code" text NOT NULL,
	"notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "purchase_order_returns_return_number_unique" UNIQUE("return_number"),
	CONSTRAINT "po_return_state_check" CHECK (state_code IN ('draft', 'staged', 'shipped', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."purchase_orders" (
	"purchase_order_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"name" text,
	"vendor_id" uuid,
	"delivery_location_id" uuid NOT NULL,
	"reference_number" text,
	"state_code" text NOT NULL,
	"base_total_amount" numeric,
	"currency_code" text NOT NULL,
	"exchange_rate" numeric NOT NULL,
	"notes" text,
	"custom_fields" jsonb,
	"expected_date" timestamp with time zone,
	"terms_description" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "purchase_orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "purchase_orders_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR')),
	CONSTRAINT "purchase_order_state_check" CHECK (state_code IN ('draft', 'ordered', 'partially_received', 'received', 'invoiced', 'cancelled', 'closed_short', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."reconciliation_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_display_name" text,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."reconciliation_rules" (
	"rule_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gl_account_ids" jsonb,
	"condition_type" text,
	"condition_value" text,
	"type_condition" text,
	"payee_condition_type" text,
	"payee_condition_value" text,
	"amount_min" numeric,
	"amount_max" numeric,
	"target_gl_account_id" uuid NOT NULL,
	"cost_center_id" uuid,
	"activity_id" uuid,
	"party_type" text,
	"party_id" text,
	"memo" text,
	"priority" integer NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."sales_credit_note_lines" (
	"credit_note_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_id" uuid NOT NULL,
	"sales_order_line_id" uuid,
	"description" text,
	"account_id" uuid,
	"tax_category_id" uuid,
	"quantity_credited" numeric NOT NULL,
	"price_per_unit" numeric NOT NULL,
	"discount_percentage" numeric,
	"amount" numeric NOT NULL,
	"tax_amount" numeric,
	"product_number" text,
	"product_name" text
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."sales_credit_notes" (
	"credit_note_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_number" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"return_id" uuid,
	"sales_order_id" uuid,
	"invoice_id" uuid,
	"total_amount" numeric NOT NULL,
	"tax_amount" numeric,
	"fee_amount" numeric,
	"outstanding_amount" numeric NOT NULL,
	"base_total_amount" numeric,
	"base_outstanding_amount" numeric,
	"currency_code" text NOT NULL,
	"exchange_rate" numeric NOT NULL,
	"state_code" text NOT NULL,
	"notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sales_credit_notes_credit_note_number_unique" UNIQUE("credit_note_number"),
	CONSTRAINT "sales_credit_notes_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'))
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."sales_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_display_name" text,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."sales_invoice_lines" (
	"invoice_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"quantity_invoiced" numeric NOT NULL,
	"price_per_unit" numeric NOT NULL,
	"amount" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."sales_invoices" (
	"invoice_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"customer_id" uuid,
	"customer_name_display" text,
	"customer_order_number" text,
	"total_amount" numeric NOT NULL,
	"outstanding_amount" numeric NOT NULL,
	"tax_amount" numeric,
	"base_total_amount" numeric,
	"base_outstanding_amount" numeric,
	"currency_code" text NOT NULL,
	"exchange_rate" numeric NOT NULL,
	"state_code" text NOT NULL,
	"invoice_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"terms_description" text,
	"notes" text,
	"early_payment_discount" numeric,
	"early_payment_discount_days" integer,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sales_invoices_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "sales_invoices_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'))
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."sales_order_lines" (
	"sales_order_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"line_type" text,
	"product_id" uuid,
	"product_description" text,
	"quantity" numeric NOT NULL,
	"price_per_unit" numeric NOT NULL,
	"unit_cost" numeric,
	"discount_percentage" numeric,
	"amount" numeric,
	"tax_category_id" uuid,
	"tax" numeric,
	"total_amount" numeric,
	"unit_of_measure" text,
	"quantity_picked" numeric,
	"fulfillment_location_id" uuid,
	"is_post_confirmation" boolean,
	"parent_line_id" uuid,
	CONSTRAINT "sales_order_lines_product_check" CHECK ((line_type = 'Product' AND tax_category_id IS NOT NULL AND fulfillment_location_id IS NOT NULL) OR line_type = 'Comment')
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."sales_order_picks" (
	"pick_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"bin_id" uuid,
	"quantity" numeric NOT NULL,
	"state_code" text NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sales_order_pick_state_check" CHECK (state_code IN ('picked', 'shipped', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."sales_order_return_lines" (
	"return_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"quantity_returned" numeric NOT NULL,
	"quantity_received" numeric,
	"reason" text,
	"resolution" text NOT NULL,
	"return_fee" numeric,
	"putaway_status" text NOT NULL,
	"product_number" text,
	"product_name" text,
	"price_per_unit" numeric,
	"discount_percentage" numeric,
	"tax_category_id" uuid
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."sales_order_returns" (
	"return_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_number" text NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"state_code" text NOT NULL,
	"location_id" uuid,
	"notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sales_order_returns_return_number_unique" UNIQUE("return_number"),
	CONSTRAINT "return_state_check" CHECK (state_code IN ('draft', 'confirmed', 'partially_received', 'received', 'processed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."sales_order_shipment_lines" (
	"shipment_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"quantity_shipped" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."sales_order_shipments" (
	"shipment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_number" text NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"state_code" text NOT NULL,
	"notes" text,
	"tracking_number" text,
	"delivery_company_name" text,
	"fulfillment_location_id" uuid,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sales_order_shipments_shipment_number_unique" UNIQUE("shipment_number"),
	CONSTRAINT "shipment_state_check" CHECK (state_code IN ('draft', 'dispatched', 'partially_received', 'received', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."sales_orders" (
	"sales_order_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"name" text,
	"customer_id" uuid,
	"customer_order_number" text,
	"fulfillment_location_id" uuid NOT NULL,
	"state_code" text NOT NULL,
	"base_total_amount" numeric,
	"currency_code" text NOT NULL,
	"exchange_rate" numeric NOT NULL,
	"notes" text,
	"shipping_notes" text,
	"delivery_company_name" text,
	"delivery_name" text,
	"delivery_phone" text,
	"delivery_address_line1" text,
	"delivery_address_line2" text,
	"delivery_city" text,
	"delivery_state" text,
	"delivery_postal_code" text,
	"delivery_country" text,
	"custom_fields" jsonb,
	"discrepancies_acknowledged" boolean NOT NULL,
	"source_id" text,
	"source" text NOT NULL,
	"terms_description" text,
	"credit_hold_override_at" timestamp with time zone,
	"credit_hold_override_by" text,
	"credit_hold_override_reason" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sales_orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "sales_orders_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "sales_orders_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR')),
	CONSTRAINT "sales_order_state_check" CHECK (state_code IN ('draft', 'quoted', 'confirmed', 'picking', 'shipped', 'invoiced', 'cancelled', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."supplier_expiries" (
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
CREATE TABLE "herobm_core"."supplier_groups" (
	"supplier_group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_code" text NOT NULL,
	"name" text NOT NULL,
	"default_ap_account_id" uuid,
	"default_expense_account_id" uuid,
	"default_cost_center_id" uuid,
	"default_activity_id" uuid,
	"trading_terms_id" uuid,
	"tax_position_id" uuid,
	"early_payment_discount" numeric,
	"early_payment_discount_days" integer,
	"credit_limit" numeric,
	"is_purchasing_blocked" boolean NOT NULL,
	"purchasing_block_reason" text,
	"is_payment_blocked" boolean NOT NULL,
	"payment_block_reason" text,
	"block_notes" text,
	CONSTRAINT "supplier_groups_group_code_unique" UNIQUE("group_code")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."suppliers" (
	"vendor_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_number" text NOT NULL,
	"supplier_group_id" uuid,
	"actor_id" uuid,
	"trading_terms_id" uuid,
	"early_payment_discount" numeric,
	"early_payment_discount_days" integer,
	"credit_limit" numeric,
	"is_purchasing_blocked" boolean NOT NULL,
	"purchasing_block_reason" text,
	"is_payment_blocked" boolean,
	"payment_block_reason" text,
	"block_notes" text,
	"currency_code" text NOT NULL,
	"state_code" text NOT NULL,
	"external_id" text,
	"notes" text,
	"bank_account_name" text,
	"bank_bsb" text,
	"bank_account_number" text,
	"tax_position_id" uuid,
	"source_id" text,
	"source" text NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "suppliers_vendor_number_unique" UNIQUE("vendor_number"),
	CONSTRAINT "suppliers_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "suppliers_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'))
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."system_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_display_name" text,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."tax_categories" (
	"tax_category_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"rate" numeric,
	"sales_gl_account_id" uuid,
	"purchase_gl_account_id" uuid,
	CONSTRAINT "tax_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."tax_position_mappings" (
	"mapping_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tax_position_id" uuid NOT NULL,
	"source_tax_category_id" uuid NOT NULL,
	"destination_tax_category_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."tax_positions" (
	"tax_position_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	CONSTRAINT "tax_positions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."trading_terms" (
	"trading_terms_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text,
	"source" text,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"days" integer NOT NULL,
	"type" text NOT NULL,
	"is_active" boolean NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "trading_terms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."transfer_order_lines" (
	"transfer_order_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric NOT NULL,
	"quantity_shipped" numeric,
	"quantity_received" numeric
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."transfer_order_picks" (
	"pick_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_order_id" uuid NOT NULL,
	"transfer_order_line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"bin_id" uuid,
	"quantity" numeric NOT NULL,
	"state_code" text NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."transfer_order_receipt_lines" (
	"receipt_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"transfer_order_line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"bin_id" uuid NOT NULL,
	"quantity" numeric NOT NULL,
	"putaway_status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."transfer_order_receipts" (
	"receipt_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_order_id" uuid NOT NULL,
	"receipt_number" text NOT NULL,
	"state_code" text NOT NULL,
	"received_by" text,
	"received_on" timestamp with time zone DEFAULT now(),
	"created_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "transfer_order_receipts_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."transfer_order_shipment_lines" (
	"shipment_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"transfer_order_line_id" uuid NOT NULL,
	"pick_id" uuid,
	"product_id" uuid NOT NULL,
	"quantity" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."transfer_order_shipments" (
	"shipment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_order_id" uuid NOT NULL,
	"shipment_number" text NOT NULL,
	"tracking_number" text,
	"carrier_id" uuid,
	"notes" text,
	"state_code" text NOT NULL,
	"shipped_by" text,
	"shipped_on" timestamp with time zone DEFAULT now(),
	"created_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "transfer_order_shipments_shipment_number_unique" UNIQUE("shipment_number")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."transfer_orders" (
	"transfer_order_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"source_location_id" uuid NOT NULL,
	"destination_location_id" uuid NOT NULL,
	"state_code" text NOT NULL,
	"notes" text,
	"shipping_notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "transfer_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."uom_dictionary" (
	"uom_code" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."user_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_display_name" text,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"dashboard_config" jsonb,
	"report_configs" jsonb,
	"preferences" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text,
	"email" text,
	"role" text NOT NULL,
	"is_active" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."warehouse_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_display_name" text,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."webhooks" (
	"webhook_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_url" text NOT NULL,
	"event_types" jsonb NOT NULL,
	"secret_key" text NOT NULL,
	"is_active" boolean NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."work_order_components" (
	"work_order_component_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"expected_quantity" numeric NOT NULL,
	"unit_cost" numeric
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."work_order_picks" (
	"pick_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"work_order_component_id" uuid NOT NULL,
	"bin_id" uuid,
	"quantity" numeric NOT NULL,
	"state_code" text NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "work_order_pick_state_check" CHECK (state_code IN ('pending', 'picked', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."work_orders" (
	"work_order_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"product_id" uuid NOT NULL,
	"target_quantity" numeric NOT NULL,
	"completed_quantity" numeric NOT NULL,
	"location_id" uuid NOT NULL,
	"wip_bin_id" uuid,
	"output_bin_id" uuid,
	"state_code" text NOT NULL,
	"putaway_status" text,
	"assembly_cost_per_unit" numeric,
	"additional_cost" numeric,
	"total_cost" numeric,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "work_orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "work_order_state_check" CHECK (state_code IN ('draft', 'planned', 'in_progress', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."zones" (
	"zone_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"source_id" text,
	"source" text NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "zones_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "zones_code_location_unq" UNIQUE("code","location_id")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."product_images" (
	"image_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"is_primary" boolean NOT NULL,
	"sort_order" integer NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."purchase_debit_note_shipments" (
	"debit_note_shipment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_line_id" uuid NOT NULL,
	"shipment_line_id" uuid NOT NULL,
	"quantity_credited" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."gl_fiscal_periods" (
	"period_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_name" text NOT NULL,
	"fiscal_year" integer NOT NULL,
	"period_number" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text NOT NULL,
	"locked_by" text,
	"locked_at" timestamp with time zone,
	"closed_by" text,
	"closed_at" timestamp with time zone,
	"notes" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "gl_fiscal_periods_period_name_unique" UNIQUE("period_name")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."user_two_factor" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"secret_encrypted" text NOT NULL,
	"is_enabled" boolean NOT NULL,
	"backup_codes" jsonb NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "herobm_core"."actor_actor_links" ADD CONSTRAINT "actor_actor_links_source_actor_id_actors_actor_id_fk" FOREIGN KEY ("source_actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."actor_actor_links" ADD CONSTRAINT "actor_actor_links_target_actor_id_actors_actor_id_fk" FOREIGN KEY ("target_actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."actor_contact_links" ADD CONSTRAINT "actor_contact_links_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."actor_contact_links" ADD CONSTRAINT "actor_contact_links_contact_id_contacts_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "herobm_core"."contacts"("contact_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."actor_notes" ADD CONSTRAINT "actor_notes_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."actor_notes" ADD CONSTRAINT "actor_notes_created_by_id_users_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."actors" ADD CONSTRAINT "actors_referred_by_actor_id_actors_actor_id_fk" FOREIGN KEY ("referred_by_actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."actors" ADD CONSTRAINT "actors_referred_by_contact_id_contacts_contact_id_fk" FOREIGN KEY ("referred_by_contact_id") REFERENCES "herobm_core"."contacts"("contact_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD CONSTRAINT "app_settings_default_fulfillment_location_id_locations_location_id_fk" FOREIGN KEY ("default_fulfillment_location_id") REFERENCES "herobm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD CONSTRAINT "app_settings_default_customer_terms_id_trading_terms_trading_terms_id_fk" FOREIGN KEY ("default_customer_terms_id") REFERENCES "herobm_core"."trading_terms"("trading_terms_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD CONSTRAINT "app_settings_default_supplier_terms_id_trading_terms_trading_terms_id_fk" FOREIGN KEY ("default_supplier_terms_id") REFERENCES "herobm_core"."trading_terms"("trading_terms_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD CONSTRAINT "app_settings_default_customer_tax_position_id_tax_positions_tax_position_id_fk" FOREIGN KEY ("default_customer_tax_position_id") REFERENCES "herobm_core"."tax_positions"("tax_position_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD CONSTRAINT "app_settings_default_supplier_tax_position_id_tax_positions_tax_position_id_fk" FOREIGN KEY ("default_supplier_tax_position_id") REFERENCES "herobm_core"."tax_positions"("tax_position_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD CONSTRAINT "app_settings_default_purchase_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("default_purchase_tax_category_id") REFERENCES "herobm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD CONSTRAINT "app_settings_default_sales_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("default_sales_tax_category_id") REFERENCES "herobm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."backorders" ADD CONSTRAINT "backorders_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "herobm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."backorders" ADD CONSTRAINT "backorders_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "herobm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."backorders" ADD CONSTRAINT "backorders_demand_work_order_id_work_orders_work_order_id_fk" FOREIGN KEY ("demand_work_order_id") REFERENCES "herobm_core"."work_orders"("work_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."backorders" ADD CONSTRAINT "backorders_work_order_component_id_work_order_components_work_order_component_id_fk" FOREIGN KEY ("work_order_component_id") REFERENCES "herobm_core"."work_order_components"("work_order_component_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."backorders" ADD CONSTRAINT "backorders_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."backorders" ADD CONSTRAINT "backorders_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "herobm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."backorders" ADD CONSTRAINT "backorders_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "herobm_core"."purchase_order_lines"("purchase_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."backorders" ADD CONSTRAINT "backorders_transfer_order_id_transfer_orders_transfer_order_id_fk" FOREIGN KEY ("transfer_order_id") REFERENCES "herobm_core"."transfer_orders"("transfer_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."backorders" ADD CONSTRAINT "backorders_transfer_order_line_id_transfer_order_lines_transfer_order_line_id_fk" FOREIGN KEY ("transfer_order_line_id") REFERENCES "herobm_core"."transfer_order_lines"("transfer_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."backorders" ADD CONSTRAINT "backorders_work_order_id_work_orders_work_order_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "herobm_core"."work_orders"("work_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_reconciliation_id_gl_reconciliations_reconciliation_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "herobm_core"."gl_reconciliations"("reconciliation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_matched_journal_line_id_gl_journal_lines_journal_line_id_fk" FOREIGN KEY ("matched_journal_line_id") REFERENCES "herobm_core"."gl_journal_lines"("journal_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_match_group_id_gl_match_groups_match_group_id_fk" FOREIGN KEY ("match_group_id") REFERENCES "herobm_core"."gl_match_groups"("match_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."bin_contents" ADD CONSTRAINT "bin_contents_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "herobm_core"."bins"("bin_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."bin_contents" ADD CONSTRAINT "bin_contents_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."bins" ADD CONSTRAINT "bins_zone_id_zones_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "herobm_core"."zones"("zone_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."contacts" ADD CONSTRAINT "contacts_referred_by_actor_id_actors_actor_id_fk" FOREIGN KEY ("referred_by_actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."contacts" ADD CONSTRAINT "contacts_referred_by_contact_id_contacts_contact_id_fk" FOREIGN KEY ("referred_by_contact_id") REFERENCES "herobm_core"."contacts"("contact_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."customer_delivery_addresses" ADD CONSTRAINT "customer_delivery_addresses_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "herobm_core"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."customer_groups" ADD CONSTRAINT "customer_groups_default_ar_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_ar_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."customer_groups" ADD CONSTRAINT "customer_groups_default_revenue_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_revenue_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."customer_groups" ADD CONSTRAINT "customer_groups_trading_terms_id_trading_terms_trading_terms_id_fk" FOREIGN KEY ("trading_terms_id") REFERENCES "herobm_core"."trading_terms"("trading_terms_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."customer_groups" ADD CONSTRAINT "customer_groups_default_cost_center_id_cost_centers_cost_center_id_fk" FOREIGN KEY ("default_cost_center_id") REFERENCES "herobm_core"."cost_centers"("cost_center_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."customer_groups" ADD CONSTRAINT "customer_groups_default_activity_id_activities_activity_id_fk" FOREIGN KEY ("default_activity_id") REFERENCES "herobm_core"."activities"("activity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."customer_groups" ADD CONSTRAINT "customer_groups_tax_position_id_tax_positions_tax_position_id_fk" FOREIGN KEY ("tax_position_id") REFERENCES "herobm_core"."tax_positions"("tax_position_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" ADD CONSTRAINT "customers_customer_group_id_customer_groups_customer_group_id_fk" FOREIGN KEY ("customer_group_id") REFERENCES "herobm_core"."customer_groups"("customer_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" ADD CONSTRAINT "customers_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" ADD CONSTRAINT "customers_tax_position_id_tax_positions_tax_position_id_fk" FOREIGN KEY ("tax_position_id") REFERENCES "herobm_core"."tax_positions"("tax_position_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" ADD CONSTRAINT "customers_trading_terms_id_trading_terms_trading_terms_id_fk" FOREIGN KEY ("trading_terms_id") REFERENCES "herobm_core"."trading_terms"("trading_terms_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."discount_matrix" ADD CONSTRAINT "discount_matrix_customer_group_id_customer_groups_customer_group_id_fk" FOREIGN KEY ("customer_group_id") REFERENCES "herobm_core"."customer_groups"("customer_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."discount_matrix" ADD CONSTRAINT "discount_matrix_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "herobm_core"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."discount_matrix" ADD CONSTRAINT "discount_matrix_product_group_id_product_groups_product_group_id_fk" FOREIGN KEY ("product_group_id") REFERENCES "herobm_core"."product_groups"("product_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_journal_entries" ADD CONSTRAINT "gl_journal_entries_reversed_by_gl_journal_entries_journal_entry_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "herobm_core"."gl_journal_entries"("journal_entry_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_journal_entry_id_gl_journal_entries_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "herobm_core"."gl_journal_entries"("journal_entry_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_reconciliation_id_gl_reconciliations_reconciliation_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "herobm_core"."gl_reconciliations"("reconciliation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_cost_center_id_cost_centers_cost_center_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "herobm_core"."cost_centers"("cost_center_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_activity_id_activities_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "herobm_core"."activities"("activity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_match_group_id_gl_match_groups_match_group_id_fk" FOREIGN KEY ("match_group_id") REFERENCES "herobm_core"."gl_match_groups"("match_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_match_groups" ADD CONSTRAINT "gl_match_groups_rule_id_reconciliation_rules_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "herobm_core"."reconciliation_rules"("rule_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_reconciliations" ADD CONSTRAINT "gl_reconciliations_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_ar_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_ar_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_ap_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_ap_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_revenue_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_revenue_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_cogs_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_cogs_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_sales_tax_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_sales_tax_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_purchase_tax_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_purchase_tax_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_expense_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_expense_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_inventory_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_inventory_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_grni_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_grni_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_realised_fx_gain_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("realised_fx_gain_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_realised_fx_loss_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("realised_fx_loss_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_unrealised_fx_gain_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("unrealised_fx_gain_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_unrealised_fx_loss_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("unrealised_fx_loss_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_shrinkage_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_shrinkage_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_ppv_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_ppv_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_cost_center_id_cost_centers_cost_center_id_fk" FOREIGN KEY ("default_cost_center_id") REFERENCES "herobm_core"."cost_centers"("cost_center_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_activity_id_activities_activity_id_fk" FOREIGN KEY ("default_activity_id") REFERENCES "herobm_core"."activities"("activity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_fee_revenue_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_fee_revenue_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_discounts_received_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_discounts_received_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_discounts_given_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_discounts_given_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_otc_cash_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_otc_cash_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_otc_card_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_otc_card_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."goods_received" ADD CONSTRAINT "goods_received_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "herobm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."goods_received" ADD CONSTRAINT "goods_received_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "herobm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."goods_received_lines" ADD CONSTRAINT "goods_received_lines_goods_received_id_goods_received_goods_received_id_fk" FOREIGN KEY ("goods_received_id") REFERENCES "herobm_core"."goods_received"("goods_received_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."goods_received_lines" ADD CONSTRAINT "goods_received_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."goods_received_lines" ADD CONSTRAINT "goods_received_lines_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "herobm_core"."purchase_order_lines"("purchase_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."goods_received_lines" ADD CONSTRAINT "goods_received_lines_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "herobm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_entry_id_inventory_entries_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "herobm_core"."inventory_entries"("entry_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "herobm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "herobm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_zone_id_zones_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "herobm_core"."zones"("zone_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payment_entries_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "herobm_core"."payment_entries"("payment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."payment_entries" ADD CONSTRAINT "payment_entries_gl_account_bank_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_bank") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."payment_lines" ADD CONSTRAINT "payment_lines_payment_id_payment_entries_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "herobm_core"."payment_entries"("payment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."payment_lines" ADD CONSTRAINT "payment_lines_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."pdf_template_contexts" ADD CONSTRAINT "pdf_template_contexts_template_id_pdf_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "herobm_core"."pdf_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."pdf_template_hooks" ADD CONSTRAINT "pdf_template_hooks_report_id_pdf_templates_id_fk" FOREIGN KEY ("report_id") REFERENCES "herobm_core"."pdf_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_components" ADD CONSTRAINT "product_components_parent_product_id_products_product_id_fk" FOREIGN KEY ("parent_product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_components" ADD CONSTRAINT "product_components_child_product_id_products_product_id_fk" FOREIGN KEY ("child_product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_default_bins" ADD CONSTRAINT "product_default_bins_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_default_bins" ADD CONSTRAINT "product_default_bins_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "herobm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_default_bins" ADD CONSTRAINT "product_default_bins_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "herobm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_groups" ADD CONSTRAINT "product_groups_default_revenue_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_revenue_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_groups" ADD CONSTRAINT "product_groups_default_expense_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_expense_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_groups" ADD CONSTRAINT "product_groups_default_cost_center_id_cost_centers_cost_center_id_fk" FOREIGN KEY ("default_cost_center_id") REFERENCES "herobm_core"."cost_centers"("cost_center_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_groups" ADD CONSTRAINT "product_groups_default_activity_id_activities_activity_id_fk" FOREIGN KEY ("default_activity_id") REFERENCES "herobm_core"."activities"("activity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_groups" ADD CONSTRAINT "product_groups_purchase_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("purchase_tax_category_id") REFERENCES "herobm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_groups" ADD CONSTRAINT "product_groups_sales_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("sales_tax_category_id") REFERENCES "herobm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_suppliers" ADD CONSTRAINT "product_suppliers_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_suppliers" ADD CONSTRAINT "product_suppliers_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "herobm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_uoms" ADD CONSTRAINT "product_uoms_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_uoms" ADD CONSTRAINT "product_uoms_uom_code_uom_dictionary_uom_code_fk" FOREIGN KEY ("uom_code") REFERENCES "herobm_core"."uom_dictionary"("uom_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."products" ADD CONSTRAINT "products_product_group_id_product_groups_product_group_id_fk" FOREIGN KEY ("product_group_id") REFERENCES "herobm_core"."product_groups"("product_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."products" ADD CONSTRAINT "products_base_uom_uom_dictionary_uom_code_fk" FOREIGN KEY ("base_uom") REFERENCES "herobm_core"."uom_dictionary"("uom_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."products" ADD CONSTRAINT "products_default_sales_uom_id_product_uoms_product_uom_id_fk" FOREIGN KEY ("default_sales_uom_id") REFERENCES "herobm_core"."product_uoms"("product_uom_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."products" ADD CONSTRAINT "products_default_purchase_uom_id_product_uoms_product_uom_id_fk" FOREIGN KEY ("default_purchase_uom_id") REFERENCES "herobm_core"."product_uoms"("product_uom_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."products" ADD CONSTRAINT "products_purchase_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("purchase_tax_category_id") REFERENCES "herobm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."products" ADD CONSTRAINT "products_sales_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("sales_tax_category_id") REFERENCES "herobm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_actors" ADD CONSTRAINT "project_actors_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "herobm_core"."projects"("project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_actors" ADD CONSTRAINT "project_actors_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_contacts" ADD CONSTRAINT "project_contacts_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "herobm_core"."projects"("project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_contacts" ADD CONSTRAINT "project_contacts_contact_id_contacts_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "herobm_core"."contacts"("contact_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_notes" ADD CONSTRAINT "project_notes_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "herobm_core"."projects"("project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_notes" ADD CONSTRAINT "project_notes_created_by_id_users_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."projects" ADD CONSTRAINT "projects_owner_id_users_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_note_lines" ADD CONSTRAINT "purchase_debit_note_lines_debit_note_id_purchase_debit_notes_debit_note_id_fk" FOREIGN KEY ("debit_note_id") REFERENCES "herobm_core"."purchase_debit_notes"("debit_note_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_note_lines" ADD CONSTRAINT "purchase_debit_note_lines_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "herobm_core"."purchase_order_lines"("purchase_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_note_lines" ADD CONSTRAINT "purchase_debit_note_lines_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_note_lines" ADD CONSTRAINT "purchase_debit_note_lines_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("tax_category_id") REFERENCES "herobm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_notes" ADD CONSTRAINT "purchase_debit_notes_return_id_purchase_order_returns_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "herobm_core"."purchase_order_returns"("return_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_notes" ADD CONSTRAINT "purchase_debit_notes_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "herobm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_notes" ADD CONSTRAINT "purchase_debit_notes_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "herobm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_invoice_id_purchase_invoices_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "herobm_core"."purchase_invoices"("invoice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "herobm_core"."purchase_order_lines"("purchase_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_invoice_receipts" ADD CONSTRAINT "purchase_invoice_receipts_invoice_line_id_purchase_invoice_lines_invoice_line_id_fk" FOREIGN KEY ("invoice_line_id") REFERENCES "herobm_core"."purchase_invoice_lines"("invoice_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_invoice_receipts" ADD CONSTRAINT "purchase_invoice_receipts_goods_received_line_id_goods_received_lines_goods_received_line_id_fk" FOREIGN KEY ("goods_received_line_id") REFERENCES "herobm_core"."goods_received_lines"("goods_received_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_invoices" ADD CONSTRAINT "purchase_invoices_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "herobm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_invoices" ADD CONSTRAINT "purchase_invoices_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "herobm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "herobm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("tax_category_id") REFERENCES "herobm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_order_return_lines" ADD CONSTRAINT "purchase_order_return_lines_return_id_purchase_order_returns_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "herobm_core"."purchase_order_returns"("return_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_order_return_lines" ADD CONSTRAINT "purchase_order_return_lines_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "herobm_core"."purchase_order_lines"("purchase_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_order_return_lines" ADD CONSTRAINT "purchase_order_return_lines_source_bin_id_bins_bin_id_fk" FOREIGN KEY ("source_bin_id") REFERENCES "herobm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_order_return_shipment_lines" ADD CONSTRAINT "purchase_order_return_shipment_lines_shipment_id_purchase_order_return_shipments_shipment_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "herobm_core"."purchase_order_return_shipments"("shipment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_order_return_shipment_lines" ADD CONSTRAINT "purchase_order_return_shipment_lines_return_line_id_purchase_order_return_lines_return_line_id_fk" FOREIGN KEY ("return_line_id") REFERENCES "herobm_core"."purchase_order_return_lines"("return_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_order_return_shipments" ADD CONSTRAINT "purchase_order_return_shipments_return_id_purchase_order_returns_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "herobm_core"."purchase_order_returns"("return_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_order_return_shipments" ADD CONSTRAINT "purchase_order_return_shipments_fulfillment_location_id_locations_location_id_fk" FOREIGN KEY ("fulfillment_location_id") REFERENCES "herobm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_order_returns" ADD CONSTRAINT "purchase_order_returns_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "herobm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "herobm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_orders" ADD CONSTRAINT "purchase_orders_delivery_location_id_locations_location_id_fk" FOREIGN KEY ("delivery_location_id") REFERENCES "herobm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_target_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("target_gl_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_cost_center_id_cost_centers_cost_center_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "herobm_core"."cost_centers"("cost_center_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_activity_id_activities_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "herobm_core"."activities"("activity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_note_lines" ADD CONSTRAINT "sales_credit_note_lines_credit_note_id_sales_credit_notes_credit_note_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "herobm_core"."sales_credit_notes"("credit_note_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_note_lines" ADD CONSTRAINT "sales_credit_note_lines_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "herobm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_note_lines" ADD CONSTRAINT "sales_credit_note_lines_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_note_lines" ADD CONSTRAINT "sales_credit_note_lines_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("tax_category_id") REFERENCES "herobm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_notes" ADD CONSTRAINT "sales_credit_notes_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "herobm_core"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_notes" ADD CONSTRAINT "sales_credit_notes_return_id_sales_order_returns_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "herobm_core"."sales_order_returns"("return_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_notes" ADD CONSTRAINT "sales_credit_notes_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "herobm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_notes" ADD CONSTRAINT "sales_credit_notes_invoice_id_sales_invoices_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "herobm_core"."sales_invoices"("invoice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_invoice_id_sales_invoices_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "herobm_core"."sales_invoices"("invoice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "herobm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoices" ADD CONSTRAINT "sales_invoices_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "herobm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoices" ADD CONSTRAINT "sales_invoices_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "herobm_core"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "herobm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("tax_category_id") REFERENCES "herobm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_fulfillment_location_id_locations_location_id_fk" FOREIGN KEY ("fulfillment_location_id") REFERENCES "herobm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_parent_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("parent_line_id") REFERENCES "herobm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_picks" ADD CONSTRAINT "sales_order_picks_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "herobm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_picks" ADD CONSTRAINT "sales_order_picks_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "herobm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_picks" ADD CONSTRAINT "sales_order_picks_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_picks" ADD CONSTRAINT "sales_order_picks_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "herobm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_return_lines" ADD CONSTRAINT "sales_order_return_lines_return_id_sales_order_returns_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "herobm_core"."sales_order_returns"("return_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_return_lines" ADD CONSTRAINT "sales_order_return_lines_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "herobm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_return_lines" ADD CONSTRAINT "sales_order_return_lines_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("tax_category_id") REFERENCES "herobm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_returns" ADD CONSTRAINT "sales_order_returns_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "herobm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_returns" ADD CONSTRAINT "sales_order_returns_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "herobm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_shipment_lines" ADD CONSTRAINT "sales_order_shipment_lines_shipment_id_sales_order_shipments_shipment_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "herobm_core"."sales_order_shipments"("shipment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_shipment_lines" ADD CONSTRAINT "sales_order_shipment_lines_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "herobm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_shipments" ADD CONSTRAINT "sales_order_shipments_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "herobm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_shipments" ADD CONSTRAINT "sales_order_shipments_fulfillment_location_id_locations_location_id_fk" FOREIGN KEY ("fulfillment_location_id") REFERENCES "herobm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_orders" ADD CONSTRAINT "sales_orders_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "herobm_core"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_orders" ADD CONSTRAINT "sales_orders_fulfillment_location_id_locations_location_id_fk" FOREIGN KEY ("fulfillment_location_id") REFERENCES "herobm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."supplier_expiries" ADD CONSTRAINT "supplier_expiries_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "herobm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."supplier_groups" ADD CONSTRAINT "supplier_groups_default_ap_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_ap_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."supplier_groups" ADD CONSTRAINT "supplier_groups_default_expense_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_expense_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."supplier_groups" ADD CONSTRAINT "supplier_groups_default_cost_center_id_cost_centers_cost_center_id_fk" FOREIGN KEY ("default_cost_center_id") REFERENCES "herobm_core"."cost_centers"("cost_center_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."supplier_groups" ADD CONSTRAINT "supplier_groups_default_activity_id_activities_activity_id_fk" FOREIGN KEY ("default_activity_id") REFERENCES "herobm_core"."activities"("activity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."supplier_groups" ADD CONSTRAINT "supplier_groups_trading_terms_id_trading_terms_trading_terms_id_fk" FOREIGN KEY ("trading_terms_id") REFERENCES "herobm_core"."trading_terms"("trading_terms_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."supplier_groups" ADD CONSTRAINT "supplier_groups_tax_position_id_tax_positions_tax_position_id_fk" FOREIGN KEY ("tax_position_id") REFERENCES "herobm_core"."tax_positions"("tax_position_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" ADD CONSTRAINT "suppliers_supplier_group_id_supplier_groups_supplier_group_id_fk" FOREIGN KEY ("supplier_group_id") REFERENCES "herobm_core"."supplier_groups"("supplier_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" ADD CONSTRAINT "suppliers_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" ADD CONSTRAINT "suppliers_trading_terms_id_trading_terms_trading_terms_id_fk" FOREIGN KEY ("trading_terms_id") REFERENCES "herobm_core"."trading_terms"("trading_terms_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" ADD CONSTRAINT "suppliers_tax_position_id_tax_positions_tax_position_id_fk" FOREIGN KEY ("tax_position_id") REFERENCES "herobm_core"."tax_positions"("tax_position_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."tax_position_mappings" ADD CONSTRAINT "tax_position_mappings_tax_position_id_tax_positions_tax_position_id_fk" FOREIGN KEY ("tax_position_id") REFERENCES "herobm_core"."tax_positions"("tax_position_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."tax_position_mappings" ADD CONSTRAINT "tax_position_mappings_source_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("source_tax_category_id") REFERENCES "herobm_core"."tax_categories"("tax_category_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."tax_position_mappings" ADD CONSTRAINT "tax_position_mappings_destination_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("destination_tax_category_id") REFERENCES "herobm_core"."tax_categories"("tax_category_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_lines" ADD CONSTRAINT "transfer_order_lines_transfer_order_id_transfer_orders_transfer_order_id_fk" FOREIGN KEY ("transfer_order_id") REFERENCES "herobm_core"."transfer_orders"("transfer_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_lines" ADD CONSTRAINT "transfer_order_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_picks" ADD CONSTRAINT "transfer_order_picks_transfer_order_id_transfer_orders_transfer_order_id_fk" FOREIGN KEY ("transfer_order_id") REFERENCES "herobm_core"."transfer_orders"("transfer_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_picks" ADD CONSTRAINT "transfer_order_picks_transfer_order_line_id_transfer_order_lines_transfer_order_line_id_fk" FOREIGN KEY ("transfer_order_line_id") REFERENCES "herobm_core"."transfer_order_lines"("transfer_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_picks" ADD CONSTRAINT "transfer_order_picks_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_picks" ADD CONSTRAINT "transfer_order_picks_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "herobm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_receipt_lines" ADD CONSTRAINT "transfer_order_receipt_lines_receipt_id_transfer_order_receipts_receipt_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "herobm_core"."transfer_order_receipts"("receipt_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_receipt_lines" ADD CONSTRAINT "transfer_order_receipt_lines_transfer_order_line_id_transfer_order_lines_transfer_order_line_id_fk" FOREIGN KEY ("transfer_order_line_id") REFERENCES "herobm_core"."transfer_order_lines"("transfer_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_receipt_lines" ADD CONSTRAINT "transfer_order_receipt_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_receipt_lines" ADD CONSTRAINT "transfer_order_receipt_lines_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "herobm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_receipts" ADD CONSTRAINT "transfer_order_receipts_transfer_order_id_transfer_orders_transfer_order_id_fk" FOREIGN KEY ("transfer_order_id") REFERENCES "herobm_core"."transfer_orders"("transfer_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_shipment_lines" ADD CONSTRAINT "transfer_order_shipment_lines_shipment_id_transfer_order_shipments_shipment_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "herobm_core"."transfer_order_shipments"("shipment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_shipment_lines" ADD CONSTRAINT "transfer_order_shipment_lines_transfer_order_line_id_transfer_order_lines_transfer_order_line_id_fk" FOREIGN KEY ("transfer_order_line_id") REFERENCES "herobm_core"."transfer_order_lines"("transfer_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_shipment_lines" ADD CONSTRAINT "transfer_order_shipment_lines_pick_id_transfer_order_picks_pick_id_fk" FOREIGN KEY ("pick_id") REFERENCES "herobm_core"."transfer_order_picks"("pick_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_shipment_lines" ADD CONSTRAINT "transfer_order_shipment_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_shipments" ADD CONSTRAINT "transfer_order_shipments_transfer_order_id_transfer_orders_transfer_order_id_fk" FOREIGN KEY ("transfer_order_id") REFERENCES "herobm_core"."transfer_orders"("transfer_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_orders" ADD CONSTRAINT "transfer_orders_source_location_id_locations_location_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "herobm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_orders" ADD CONSTRAINT "transfer_orders_destination_location_id_locations_location_id_fk" FOREIGN KEY ("destination_location_id") REFERENCES "herobm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."user_settings" ADD CONSTRAINT "user_settings_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_order_components" ADD CONSTRAINT "work_order_components_work_order_id_work_orders_work_order_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "herobm_core"."work_orders"("work_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_order_components" ADD CONSTRAINT "work_order_components_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_order_picks" ADD CONSTRAINT "work_order_picks_work_order_id_work_orders_work_order_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "herobm_core"."work_orders"("work_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_order_picks" ADD CONSTRAINT "work_order_picks_work_order_component_id_work_order_components_work_order_component_id_fk" FOREIGN KEY ("work_order_component_id") REFERENCES "herobm_core"."work_order_components"("work_order_component_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_order_picks" ADD CONSTRAINT "work_order_picks_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "herobm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_orders" ADD CONSTRAINT "work_orders_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_orders" ADD CONSTRAINT "work_orders_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "herobm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_orders" ADD CONSTRAINT "work_orders_wip_bin_id_bins_bin_id_fk" FOREIGN KEY ("wip_bin_id") REFERENCES "herobm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_orders" ADD CONSTRAINT "work_orders_output_bin_id_bins_bin_id_fk" FOREIGN KEY ("output_bin_id") REFERENCES "herobm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."zones" ADD CONSTRAINT "zones_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "herobm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_images" ADD CONSTRAINT "product_images_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_note_shipments" ADD CONSTRAINT "purchase_debit_note_shipments_debit_note_line_id_purchase_debit_note_lines_debit_note_line_id_fk" FOREIGN KEY ("debit_note_line_id") REFERENCES "herobm_core"."purchase_debit_note_lines"("debit_note_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_note_shipments" ADD CONSTRAINT "purchase_debit_note_shipments_shipment_line_id_purchase_order_return_shipment_lines_shipment_line_id_fk" FOREIGN KEY ("shipment_line_id") REFERENCES "herobm_core"."purchase_order_return_shipment_lines"("shipment_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."user_two_factor" ADD CONSTRAINT "user_two_factor_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_backorders_sol_state" ON "herobm_core"."backorders" USING btree ("sales_order_line_id","state_code");--> statement-breakpoint
CREATE INDEX "idx_backorders_woc_state" ON "herobm_core"."backorders" USING btree ("work_order_component_id","state_code");--> statement-breakpoint
CREATE INDEX "idx_backorders_product" ON "herobm_core"."backorders" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_bin_contents_product_id" ON "herobm_core"."bin_contents" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_discount_matrix_customer_group" ON "herobm_core"."discount_matrix" USING btree ("customer_group_id");--> statement-breakpoint
CREATE INDEX "idx_discount_matrix_customer" ON "herobm_core"."discount_matrix" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gl_journal_entries_sequence_number" ON "herobm_core"."gl_journal_entries" USING btree ("sequence_number");--> statement-breakpoint
CREATE INDEX "idx_inventory_entries_entry_date" ON "herobm_core"."inventory_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "idx_inventory_ledger_product_location" ON "herobm_core"."inventory_ledger" USING btree ("product_id","location_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_ledger_entry_id" ON "herobm_core"."inventory_ledger" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_invoice_lines_po_line" ON "herobm_core"."purchase_invoice_lines" USING btree ("purchase_order_line_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_order_lines_product" ON "herobm_core"."purchase_order_lines" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_po_line_number" ON "herobm_core"."purchase_order_lines" USING btree ("purchase_order_id","line_number") WHERE "herobm_core"."purchase_order_lines"."purchase_order_id" != '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
CREATE INDEX "idx_purchase_orders_delivery_location" ON "herobm_core"."purchase_orders" USING btree ("delivery_location_id");--> statement-breakpoint
CREATE INDEX "idx_sales_credit_note_lines_so_line" ON "herobm_core"."sales_credit_note_lines" USING btree ("sales_order_line_id");--> statement-breakpoint
CREATE INDEX "idx_sales_invoice_lines_so_line" ON "herobm_core"."sales_invoice_lines" USING btree ("sales_order_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_so_line_number" ON "herobm_core"."sales_order_lines" USING btree ("sales_order_id","line_number") WHERE "herobm_core"."sales_order_lines"."sales_order_id" != '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
CREATE INDEX "idx_sales_order_lines_product_location" ON "herobm_core"."sales_order_lines" USING btree ("product_id","fulfillment_location_id");--> statement-breakpoint
CREATE INDEX "idx_sales_order_lines_order_id" ON "herobm_core"."sales_order_lines" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "idx_sales_order_lines_parent_line" ON "herobm_core"."sales_order_lines" USING btree ("parent_line_id");--> statement-breakpoint
CREATE INDEX "idx_sales_order_picks_order" ON "herobm_core"."sales_order_picks" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "idx_sales_order_picks_line" ON "herobm_core"."sales_order_picks" USING btree ("sales_order_line_id");--> statement-breakpoint
CREATE INDEX "idx_sales_order_return_lines_so_line" ON "herobm_core"."sales_order_return_lines" USING btree ("sales_order_line_id");--> statement-breakpoint
CREATE INDEX "idx_sales_order_shipment_lines_so_line" ON "herobm_core"."sales_order_shipment_lines" USING btree ("sales_order_line_id");--> statement-breakpoint
CREATE INDEX "idx_sales_orders_customer_id" ON "herobm_core"."sales_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_sales_orders_fulfillment_location_id" ON "herobm_core"."sales_orders" USING btree ("fulfillment_location_id");--> statement-breakpoint
CREATE INDEX "idx_sales_orders_state_code" ON "herobm_core"."sales_orders" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX "idx_sales_orders_created_on" ON "herobm_core"."sales_orders" USING btree ("created_on");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_position_mappings_unique_idx" ON "herobm_core"."tax_position_mappings" USING btree ("tax_position_id","source_tax_category_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_order_lines_product" ON "herobm_core"."transfer_order_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_order_picks_order" ON "herobm_core"."transfer_order_picks" USING btree ("transfer_order_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_order_picks_line" ON "herobm_core"."transfer_order_picks" USING btree ("transfer_order_line_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_order_receipt_lines_receipt" ON "herobm_core"."transfer_order_receipt_lines" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_order_receipts_order" ON "herobm_core"."transfer_order_receipts" USING btree ("transfer_order_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_order_shipment_lines_shipment" ON "herobm_core"."transfer_order_shipment_lines" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_order_shipments_order" ON "herobm_core"."transfer_order_shipments" USING btree ("transfer_order_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_orders_source_location" ON "herobm_core"."transfer_orders" USING btree ("source_location_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_orders_dest_location" ON "herobm_core"."transfer_orders" USING btree ("destination_location_id");--> statement-breakpoint
CREATE INDEX "idx_work_order_components_wo" ON "herobm_core"."work_order_components" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "idx_work_order_picks_wo" ON "herobm_core"."work_order_picks" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "idx_work_orders_location" ON "herobm_core"."work_orders" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_gl_fiscal_periods_year_period" ON "herobm_core"."gl_fiscal_periods" USING btree ("fiscal_year","period_number");--> statement-breakpoint
CREATE INDEX "idx_gl_fiscal_periods_dates" ON "herobm_core"."gl_fiscal_periods" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_gl_fiscal_periods_status" ON "herobm_core"."gl_fiscal_periods" USING btree ("status");
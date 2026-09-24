CREATE TABLE "herobm_core"."crm_settings" (
	"settings_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_metadata_schema" jsonb,
	"opportunity_metadata_schema" jsonb,
	"contact_metadata_schema" jsonb,
	"customer_metadata_schema" jsonb,
	"supplier_metadata_schema" jsonb,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."product_settings" (
	"settings_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_metadata_schema" jsonb,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."stocktake_counts" (
	"stocktake_count_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stocktake_id" uuid NOT NULL,
	"stocktake_line_id" uuid,
	"product_id" uuid NOT NULL,
	"bin_id" uuid NOT NULL,
	"quantity" numeric NOT NULL,
	"count_mode" text NOT NULL,
	"counted_by" text NOT NULL,
	"counted_at" timestamp with time zone DEFAULT now(),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."stocktake_lines" (
	"stocktake_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stocktake_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"bin_id" uuid NOT NULL,
	"expected_quantity" numeric NOT NULL,
	"counted_quantity" numeric,
	"is_unlisted" boolean NOT NULL,
	"notes" text,
	"last_counted_at" timestamp with time zone,
	"last_counted_by" text,
	CONSTRAINT "stocktake_lines_stocktake_prod_bin_unq" UNIQUE("stocktake_id","product_id","bin_id")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."stocktakes" (
	"stocktake_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stocktake_number" text NOT NULL,
	"name" text NOT NULL,
	"location_id" uuid NOT NULL,
	"state_code" text NOT NULL,
	"scope_type" text NOT NULL,
	"zone_filter" text,
	"bin_pattern" text,
	"is_blind_count" boolean NOT NULL,
	"notes" text,
	"inventory_entry_id" uuid,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"opened_by" text,
	"opened_at" timestamp with time zone,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"submitted_by" text,
	"submitted_on" timestamp with time zone,
	"cancelled_by" text,
	"cancelled_at" timestamp with time zone,
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "stocktakes_stocktake_number_unique" UNIQUE("stocktake_number")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."sales_settings" (
	"sales_settings_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_metadata_schema" jsonb,
	"sales_invoice_metadata_schema" jsonb,
	"credit_note_metadata_schema" jsonb,
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."purchasing_settings" (
	"purchasing_settings_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_metadata_schema" jsonb,
	"debit_note_metadata_schema" jsonb,
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."manufacturing_settings" (
	"manufacturing_settings_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_metadata_schema" jsonb,
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."project_budget_lines" (
	"budget_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"project_task_id" uuid NOT NULL,
	"line_type" text NOT NULL,
	"resource_id" uuid,
	"product_id" uuid,
	"description" text,
	"planned_quantity" numeric NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"total_cost" numeric(12, 2) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"total_price" numeric(12, 2) NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."project_ledger_entries" (
	"ledger_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"project_task_id" uuid NOT NULL,
	"entry_type" text NOT NULL,
	"line_type" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"inventory_entry_id" uuid,
	"resource_id" uuid,
	"product_id" uuid,
	"user_id" uuid,
	"description" text,
	"quantity" numeric NOT NULL,
	"unit_cost_base" numeric(12, 2) NOT NULL,
	"total_cost_base" numeric(12, 2) NOT NULL,
	"unit_price_base" numeric(12, 2) NOT NULL,
	"total_price_base" numeric(12, 2) NOT NULL,
	"is_billable" boolean DEFAULT true NOT NULL,
	"is_billed" boolean DEFAULT false NOT NULL,
	"sales_invoice_line_id" uuid,
	"posting_date" timestamp with time zone NOT NULL,
	"created_by" text NOT NULL,
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
CREATE TABLE "herobm_core"."project_resources" (
	"resource_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_number" text NOT NULL,
	"name" text NOT NULL,
	"resource_type" text NOT NULL,
	"user_id" uuid,
	"vendor_id" uuid,
	"service_product_id" uuid,
	"base_uom" text NOT NULL,
	"direct_unit_cost" numeric(12, 2) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"is_active" boolean NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "project_resources_resource_number_unique" UNIQUE("resource_number")
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."project_settings" (
	"settings_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_metadata_schema" jsonb,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."project_tasks" (
	"project_task_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"task_code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_task_id" uuid,
	"state_code" text NOT NULL,
	"is_milestone" boolean NOT NULL,
	"is_billable" boolean NOT NULL,
	"planned_start_date" timestamp with time zone,
	"planned_end_date" timestamp with time zone,
	"actual_start_date" timestamp with time zone,
	"actual_end_date" timestamp with time zone,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."projects" (
	"project_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_number" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"customer_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"state_code" text NOT NULL,
	"stage" text,
	"billing_type" text NOT NULL,
	"project_manager_id" uuid,
	"currency_code" text NOT NULL,
	"staging_location_id" uuid,
	"staging_bin_id" uuid,
	"start_date" timestamp with time zone,
	"target_end_date" timestamp with time zone,
	"actual_end_date" timestamp with time zone,
	"wip_method" text NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "projects_project_number_unique" UNIQUE("project_number"),
	CONSTRAINT "projects_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'))
);
--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD COLUMN IF NOT EXISTS "allow_negative_inventory" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD COLUMN IF NOT EXISTS "project_stages" jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."contacts" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_accounts" ADD COLUMN IF NOT EXISTS "report_category" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD COLUMN IF NOT EXISTS "default_suspense_account_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD COLUMN IF NOT EXISTS "default_retained_earnings_account_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."opportunities" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."organizations" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."products" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_notes" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_orders" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_notes" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoices" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_orders" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_lines" ADD COLUMN IF NOT EXISTS "project_task_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_orders" ADD COLUMN IF NOT EXISTS "project_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_orders" ADD COLUMN IF NOT EXISTS "project_task_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_orders" ADD COLUMN IF NOT EXISTS "is_project_return" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."uom_dictionary" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'count' NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_orders" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."stocktake_counts" ADD CONSTRAINT "stocktake_counts_stocktake_id_stocktakes_stocktake_id_fk" FOREIGN KEY ("stocktake_id") REFERENCES "herobm_core"."stocktakes"("stocktake_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."stocktake_counts" ADD CONSTRAINT "stocktake_counts_stocktake_line_id_stocktake_lines_stocktake_line_id_fk" FOREIGN KEY ("stocktake_line_id") REFERENCES "herobm_core"."stocktake_lines"("stocktake_line_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."stocktake_counts" ADD CONSTRAINT "stocktake_counts_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."stocktake_counts" ADD CONSTRAINT "stocktake_counts_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "herobm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."stocktake_lines" ADD CONSTRAINT "stocktake_lines_stocktake_id_stocktakes_stocktake_id_fk" FOREIGN KEY ("stocktake_id") REFERENCES "herobm_core"."stocktakes"("stocktake_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."stocktake_lines" ADD CONSTRAINT "stocktake_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."stocktake_lines" ADD CONSTRAINT "stocktake_lines_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "herobm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."stocktakes" ADD CONSTRAINT "stocktakes_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "herobm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."stocktakes" ADD CONSTRAINT "stocktakes_inventory_entry_id_inventory_entries_entry_id_fk" FOREIGN KEY ("inventory_entry_id") REFERENCES "herobm_core"."inventory_entries"("entry_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_budget_lines" ADD CONSTRAINT "project_budget_lines_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "herobm_core"."projects"("project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_budget_lines" ADD CONSTRAINT "project_budget_lines_project_task_id_project_tasks_project_task_id_fk" FOREIGN KEY ("project_task_id") REFERENCES "herobm_core"."project_tasks"("project_task_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_budget_lines" ADD CONSTRAINT "project_budget_lines_resource_id_project_resources_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "herobm_core"."project_resources"("resource_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_budget_lines" ADD CONSTRAINT "project_budget_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_ledger_entries" ADD CONSTRAINT "project_ledger_entries_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "herobm_core"."projects"("project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_ledger_entries" ADD CONSTRAINT "project_ledger_entries_project_task_id_project_tasks_project_task_id_fk" FOREIGN KEY ("project_task_id") REFERENCES "herobm_core"."project_tasks"("project_task_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_ledger_entries" ADD CONSTRAINT "project_ledger_entries_inventory_entry_id_inventory_entries_entry_id_fk" FOREIGN KEY ("inventory_entry_id") REFERENCES "herobm_core"."inventory_entries"("entry_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_ledger_entries" ADD CONSTRAINT "project_ledger_entries_resource_id_project_resources_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "herobm_core"."project_resources"("resource_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_ledger_entries" ADD CONSTRAINT "project_ledger_entries_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_ledger_entries" ADD CONSTRAINT "project_ledger_entries_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_notes" ADD CONSTRAINT "project_notes_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "herobm_core"."projects"("project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_notes" ADD CONSTRAINT "project_notes_created_by_id_users_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_resources" ADD CONSTRAINT "project_resources_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_resources" ADD CONSTRAINT "project_resources_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "herobm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_resources" ADD CONSTRAINT "project_resources_service_product_id_products_product_id_fk" FOREIGN KEY ("service_product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_resources" ADD CONSTRAINT "project_resources_base_uom_uom_dictionary_uom_code_fk" FOREIGN KEY ("base_uom") REFERENCES "herobm_core"."uom_dictionary"("uom_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_tasks" ADD CONSTRAINT "project_tasks_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "herobm_core"."projects"("project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_tasks" ADD CONSTRAINT "project_tasks_parent_task_id_project_tasks_project_task_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "herobm_core"."project_tasks"("project_task_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."projects" ADD CONSTRAINT "projects_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "herobm_core"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."projects" ADD CONSTRAINT "projects_opportunity_id_opportunities_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "herobm_core"."opportunities"("opportunity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."projects" ADD CONSTRAINT "projects_project_manager_id_users_user_id_fk" FOREIGN KEY ("project_manager_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."projects" ADD CONSTRAINT "projects_staging_location_id_locations_location_id_fk" FOREIGN KEY ("staging_location_id") REFERENCES "herobm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."projects" ADD CONSTRAINT "projects_staging_bin_id_bins_bin_id_fk" FOREIGN KEY ("staging_bin_id") REFERENCES "herobm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stocktake_counts_stocktake_id" ON "herobm_core"."stocktake_counts" USING btree ("stocktake_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stocktake_counts_line_id" ON "herobm_core"."stocktake_counts" USING btree ("stocktake_line_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stocktake_counts_product_id" ON "herobm_core"."stocktake_counts" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stocktake_counts_bin_id" ON "herobm_core"."stocktake_counts" USING btree ("bin_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stocktake_counts_counted_by" ON "herobm_core"."stocktake_counts" USING btree ("counted_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stocktake_lines_stocktake_id" ON "herobm_core"."stocktake_lines" USING btree ("stocktake_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stocktake_lines_product_id" ON "herobm_core"."stocktake_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stocktake_lines_bin_id" ON "herobm_core"."stocktake_lines" USING btree ("bin_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stocktakes_location_id" ON "herobm_core"."stocktakes" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stocktakes_state_code" ON "herobm_core"."stocktakes" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stocktakes_created_on" ON "herobm_core"."stocktakes" USING btree ("created_on");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_budget_lines_project_id" ON "herobm_core"."project_budget_lines" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_budget_lines_task_id" ON "herobm_core"."project_budget_lines" USING btree ("project_task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_ledger_entries_project_id" ON "herobm_core"."project_ledger_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_ledger_entries_task_id" ON "herobm_core"."project_ledger_entries" USING btree ("project_task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_ledger_entries_source" ON "herobm_core"."project_ledger_entries" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_ledger_entries_posting_date" ON "herobm_core"."project_ledger_entries" USING btree ("posting_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_ledger_entries_user_id" ON "herobm_core"."project_ledger_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_notes_project_id" ON "herobm_core"."project_notes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_notes_created_by_id" ON "herobm_core"."project_notes" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_resources_user_id" ON "herobm_core"."project_resources" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_resources_vendor_id" ON "herobm_core"."project_resources" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_tasks_project_id" ON "herobm_core"."project_tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_tasks_parent_task_id" ON "herobm_core"."project_tasks" USING btree ("parent_task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_customer_id" ON "herobm_core"."projects" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_state_code" ON "herobm_core"."projects" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_pm_id" ON "herobm_core"."projects" USING btree ("project_manager_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_staging_location_id" ON "herobm_core"."projects" USING btree ("staging_location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_staging_bin_id" ON "herobm_core"."projects" USING btree ("staging_bin_id");--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_suspense_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_suspense_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_retained_earnings_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_retained_earnings_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_lines" ADD CONSTRAINT "transfer_order_lines_project_task_id_project_tasks_project_task_id_fk" FOREIGN KEY ("project_task_id") REFERENCES "herobm_core"."project_tasks"("project_task_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_orders" ADD CONSTRAINT "transfer_orders_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "herobm_core"."projects"("project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_orders" ADD CONSTRAINT "transfer_orders_project_task_id_project_tasks_project_task_id_fk" FOREIGN KEY ("project_task_id") REFERENCES "herobm_core"."project_tasks"("project_task_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transfer_order_lines_project_task_id" ON "herobm_core"."transfer_order_lines" USING btree ("project_task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transfer_orders_project_id" ON "herobm_core"."transfer_orders" USING btree ("project_id");
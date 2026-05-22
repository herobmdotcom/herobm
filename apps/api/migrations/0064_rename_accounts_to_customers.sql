ALTER TABLE "modbm_core"."account_events" RENAME TO "customer_events";--> statement-breakpoint
ALTER TABLE "modbm_core"."account_groups" RENAME TO "customer_groups";--> statement-breakpoint
ALTER TABLE "modbm_core"."accounts" RENAME TO "customers";--> statement-breakpoint
ALTER TABLE "modbm_core"."customer_events" RENAME COLUMN "account_id" TO "customer_id";--> statement-breakpoint
ALTER TABLE "modbm_core"."customer_groups" RENAME COLUMN "account_group_id" TO "customer_group_id";--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" RENAME COLUMN "account_id" TO "customer_id";--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" RENAME COLUMN "account_number" TO "customer_number";--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" RENAME COLUMN "account_group_id" TO "customer_group_id";--> statement-breakpoint
ALTER TABLE "modbm_core"."discount_matrix" RENAME COLUMN "account_group_id" TO "customer_group_id";--> statement-breakpoint
ALTER TABLE "modbm_core"."discount_matrix" RENAME COLUMN "account_id" TO "customer_id";--> statement-breakpoint
ALTER TABLE "modbm_core"."customer_groups" DROP CONSTRAINT "account_groups_group_code_unique";--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" DROP CONSTRAINT "accounts_account_number_unique";--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" DROP CONSTRAINT "accounts_source_id_unique";--> statement-breakpoint
ALTER TABLE "modbm_core"."discount_matrix" DROP CONSTRAINT "discount_matrix_account_product_unq";--> statement-breakpoint
ALTER TABLE "modbm_core"."discount_matrix" DROP CONSTRAINT "discount_matrix_group_product_unq";--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" DROP CONSTRAINT "accounts_currency_check";--> statement-breakpoint
ALTER TABLE "modbm_core"."discount_matrix" DROP CONSTRAINT "discount_matrix_owner_check";--> statement-breakpoint
ALTER TABLE "modbm_core"."customer_events" DROP CONSTRAINT "account_events_account_id_accounts_account_id_fk";
--> statement-breakpoint
ALTER TABLE "modbm_core"."customer_groups" DROP CONSTRAINT "account_groups_default_ar_account_id_gl_accounts_gl_account_id_";
--> statement-breakpoint
ALTER TABLE "modbm_core"."customer_groups" DROP CONSTRAINT "account_groups_default_revenue_account_id_gl_accounts_gl_accoun";
--> statement-breakpoint
ALTER TABLE "modbm_core"."customer_groups" DROP CONSTRAINT "account_groups_trading_terms_id_trading_terms_trading_terms_id_";
--> statement-breakpoint
ALTER TABLE "modbm_core"."customer_groups" DROP CONSTRAINT "account_groups_default_cost_center_id_fkey";
--> statement-breakpoint
ALTER TABLE "modbm_core"."customer_groups" DROP CONSTRAINT "account_groups_default_activity_id_fkey";
--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" DROP CONSTRAINT "accounts_account_group_id_account_groups_account_group_id_fk";
--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" DROP CONSTRAINT "accounts_gst_category_id_gst_categories_gst_category_id_fk";
--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" DROP CONSTRAINT "accounts_trading_terms_id_trading_terms_trading_terms_id_fk";
--> statement-breakpoint
ALTER TABLE "modbm_core"."discount_matrix" DROP CONSTRAINT "discount_matrix_account_group_id_account_groups_account_group_i";
--> statement-breakpoint
ALTER TABLE "modbm_core"."discount_matrix" DROP CONSTRAINT "discount_matrix_account_id_accounts_account_id_fk";
--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_orders" DROP CONSTRAINT "sales_orders_customer_id_accounts_account_id_fk";
--> statement-breakpoint
DROP INDEX "modbm_core"."idx_discount_matrix_account_group";--> statement-breakpoint
DROP INDEX "modbm_core"."idx_discount_matrix_account";--> statement-breakpoint
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
ALTER TABLE "modbm_core"."sales_orders" ADD CONSTRAINT "sales_orders_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "modbm_core"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_discount_matrix_customer_group" ON "modbm_core"."discount_matrix" USING btree ("customer_group_id");--> statement-breakpoint
CREATE INDEX "idx_discount_matrix_customer" ON "modbm_core"."discount_matrix" USING btree ("customer_id");--> statement-breakpoint
ALTER TABLE "modbm_core"."customer_groups" ADD CONSTRAINT "customer_groups_group_code_unique" UNIQUE("group_code");--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" ADD CONSTRAINT "customers_customer_number_unique" UNIQUE("customer_number");--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" ADD CONSTRAINT "customers_source_id_unique" UNIQUE("source_id");--> statement-breakpoint
ALTER TABLE "modbm_core"."discount_matrix" ADD CONSTRAINT "discount_matrix_customer_product_unq" UNIQUE("customer_id","product_group_id");--> statement-breakpoint
ALTER TABLE "modbm_core"."discount_matrix" ADD CONSTRAINT "discount_matrix_group_product_unq" UNIQUE("customer_group_id","product_group_id");--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" ADD CONSTRAINT "customers_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'));--> statement-breakpoint
ALTER TABLE "modbm_core"."discount_matrix" ADD CONSTRAINT "discount_matrix_owner_check" CHECK ((customer_group_id IS NOT NULL AND customer_id IS NULL) OR
          (customer_group_id IS NULL AND customer_id IS NOT NULL));
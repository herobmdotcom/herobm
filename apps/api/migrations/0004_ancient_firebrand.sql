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
CREATE TABLE "modbm_core"."product_groups" (
	"product_group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_code" text NOT NULL,
	"name" text NOT NULL,
	"default_revenue_account_id" uuid,
	"default_expense_account_id" uuid,
	CONSTRAINT "product_groups_group_code_unique" UNIQUE("group_code")
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
ALTER TABLE "modbm_core"."accounts" ADD COLUMN "account_group_id" uuid;--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ADD COLUMN "product_group_id" uuid;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD COLUMN "supplier_group_id" uuid;--> statement-breakpoint
ALTER TABLE "modbm_core"."account_groups" ADD CONSTRAINT "account_groups_default_ar_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_ar_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."account_groups" ADD CONSTRAINT "account_groups_default_revenue_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_revenue_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_groups" ADD CONSTRAINT "product_groups_default_revenue_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_revenue_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_groups" ADD CONSTRAINT "product_groups_default_expense_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_expense_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_groups" ADD CONSTRAINT "supplier_groups_default_ap_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_ap_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."accounts" ADD CONSTRAINT "accounts_account_group_id_account_groups_account_group_id_fk" FOREIGN KEY ("account_group_id") REFERENCES "modbm_core"."account_groups"("account_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ADD CONSTRAINT "products_product_group_id_product_groups_product_group_id_fk" FOREIGN KEY ("product_group_id") REFERENCES "modbm_core"."product_groups"("product_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD CONSTRAINT "suppliers_supplier_group_id_supplier_groups_supplier_group_id_fk" FOREIGN KEY ("supplier_group_id") REFERENCES "modbm_core"."supplier_groups"("supplier_group_id") ON DELETE no action ON UPDATE no action;
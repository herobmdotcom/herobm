-- Custom SQL migration file, put your code below! --
ALTER TABLE "herobm_core"."tax_categories" ADD COLUMN "sales_gl_account_id" uuid;
ALTER TABLE "herobm_core"."tax_categories" ADD COLUMN "purchase_gl_account_id" uuid;
ALTER TABLE "herobm_core"."tax_categories" ADD CONSTRAINT "tax_categories_sales_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("sales_gl_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "herobm_core"."tax_categories" ADD CONSTRAINT "tax_categories_purchase_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("purchase_gl_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "herobm_core"."gl_settings" ADD COLUMN "default_sales_tax_account_id" uuid;
ALTER TABLE "herobm_core"."gl_settings" ADD COLUMN "default_purchase_tax_account_id" uuid;
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_sales_tax_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_sales_tax_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_purchase_tax_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_purchase_tax_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE set null ON UPDATE no action;

-- Migrate data
UPDATE "herobm_core"."gl_settings" SET "default_sales_tax_account_id" = "default_tax_account_id", "default_purchase_tax_account_id" = "default_tax_account_id";

-- Drop old constraint and column
ALTER TABLE "herobm_core"."gl_settings" DROP CONSTRAINT IF EXISTS "gl_settings_default_tax_account_id_gl_accounts_gl_account_id_fk";
ALTER TABLE "herobm_core"."gl_settings" DROP COLUMN IF EXISTS "default_tax_account_id";
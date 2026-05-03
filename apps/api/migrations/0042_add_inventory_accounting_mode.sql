ALTER TABLE "modbm_core"."app_settings" ADD COLUMN IF NOT EXISTS "inventory_accounting_mode" text DEFAULT 'periodic' NOT NULL;
ALTER TABLE "modbm_core"."gl_settings" ADD COLUMN IF NOT EXISTS "default_inventory_account_id" uuid;
ALTER TABLE "modbm_core"."gl_settings" ADD COLUMN IF NOT EXISTS "default_grni_account_id" uuid;
ALTER TABLE "modbm_core"."gl_settings" ADD COLUMN IF NOT EXISTS "default_shrinkage_account_id" uuid;
DO $$ BEGIN
 ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_inventory_account_id_accounts_gl_account_id_fk" FOREIGN KEY ("default_inventory_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
 ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_grni_account_id_accounts_gl_account_id_fk" FOREIGN KEY ("default_grni_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
 ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_shrinkage_account_id_accounts_gl_account_id_fk" FOREIGN KEY ("default_shrinkage_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

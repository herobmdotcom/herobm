-- Custom SQL migration file, put you code below! --
ALTER TABLE "modbm_core"."sales_invoices" ADD COLUMN IF NOT EXISTS "outstanding_amount" numeric DEFAULT '0' NOT NULL;
ALTER TABLE "modbm_core"."purchase_invoices" ADD COLUMN IF NOT EXISTS "outstanding_amount" numeric DEFAULT '0' NOT NULL;
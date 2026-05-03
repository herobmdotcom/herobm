ALTER TABLE "modbm_core"."accounts" ALTER COLUMN "currency_code" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_accounts" ALTER COLUMN "currency_code" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoices" ALTER COLUMN "currency_code" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_orders" ALTER COLUMN "currency_code" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_invoices" ALTER COLUMN "currency_code" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_orders" ALTER COLUMN "currency_code" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ALTER COLUMN "currency_code" DROP DEFAULT;
ALTER TABLE "modbm_core"."customers" ALTER COLUMN "address1_country" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ALTER COLUMN "address1_country" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "modbm_core"."product_type" ADD VALUE IF NOT EXISTS 'freight';
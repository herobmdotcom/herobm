ALTER TABLE "herobm_core"."customers" ALTER COLUMN "address1_country" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" ALTER COLUMN "address1_country" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "herobm_core"."product_type" ADD VALUE IF NOT EXISTS 'freight';
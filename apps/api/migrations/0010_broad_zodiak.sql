ALTER TYPE "herobm_core"."product_type" ADD VALUE 'freight';--> statement-breakpoint
UPDATE "herobm_core"."customers" SET "address1_country" = (SELECT "country" FROM "herobm_core"."organization" LIMIT 1) WHERE "address1_country" IS NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" ALTER COLUMN "address1_country" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" ALTER COLUMN "address1_country" SET NOT NULL;--> statement-breakpoint
UPDATE "herobm_core"."suppliers" SET "address1_country" = (SELECT "country" FROM "herobm_core"."organization" LIMIT 1) WHERE "address1_country" IS NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" ALTER COLUMN "address1_country" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" ALTER COLUMN "address1_country" SET NOT NULL;
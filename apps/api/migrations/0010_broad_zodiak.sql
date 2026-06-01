ALTER TYPE "modbm_core"."product_type" ADD VALUE 'freight';--> statement-breakpoint
UPDATE "modbm_core"."customers" SET "address1_country" = (SELECT "country" FROM "modbm_core"."organization" LIMIT 1) WHERE "address1_country" IS NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" ALTER COLUMN "address1_country" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" ALTER COLUMN "address1_country" SET NOT NULL;--> statement-breakpoint
UPDATE "modbm_core"."suppliers" SET "address1_country" = (SELECT "country" FROM "modbm_core"."organization" LIMIT 1) WHERE "address1_country" IS NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ALTER COLUMN "address1_country" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ALTER COLUMN "address1_country" SET NOT NULL;
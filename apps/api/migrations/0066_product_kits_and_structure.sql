DO $$ BEGIN
    CREATE TYPE "public"."product_structure" AS ENUM('standard', 'kit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."product_type" AS ENUM('inventory', 'non-stock', 'service');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ALTER COLUMN "product_type" SET DEFAULT 'inventory'::"public"."product_type";--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ALTER COLUMN "product_type" SET DATA TYPE "public"."product_type" USING "product_type"::"public"."product_type";--> statement-breakpoint
ALTER TABLE "modbm_core"."product_components" ADD COLUMN IF NOT EXISTS "parent_quantity" numeric(14, 4) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ADD COLUMN IF NOT EXISTS "structure_type" "product_structure" DEFAULT 'standard' NOT NULL;
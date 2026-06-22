ALTER TABLE "herobm_core"."bins" ALTER COLUMN "bin_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "herobm_core"."macros" ALTER COLUMN "macro_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "herobm_core"."products" ALTER COLUMN "product_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "herobm_core"."products" ALTER COLUMN "base_uom" DROP DEFAULT;
CREATE TABLE IF NOT EXISTS "herobm_core"."product_images" (
	"image_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "herobm_core"."product_components" ALTER COLUMN "fractional_behavior" SET DEFAULT 'allow_fractional';--> statement-breakpoint
ALTER TABLE "herobm_core"."product_components" ALTER COLUMN "fractional_behavior" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_uoms" ALTER COLUMN "ratio" SET DATA TYPE numeric(12, 4);--> statement-breakpoint
ALTER TABLE "herobm_core"."products" ADD COLUMN IF NOT EXISTS "image_path" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "herobm_core"."product_images" ADD CONSTRAINT "product_images_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
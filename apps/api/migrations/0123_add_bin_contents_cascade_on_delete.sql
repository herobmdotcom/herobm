ALTER TABLE "herobm_core"."bin_contents" DROP CONSTRAINT "bin_contents_bin_id_bins_bin_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."bin_contents" DROP CONSTRAINT "bin_contents_product_id_products_product_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."bin_contents" ADD CONSTRAINT "bin_contents_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "herobm_core"."bins"("bin_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."bin_contents" ADD CONSTRAINT "bin_contents_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE cascade ON UPDATE no action;
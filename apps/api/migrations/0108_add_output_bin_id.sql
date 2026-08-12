ALTER TABLE "herobm_core"."work_orders" ADD COLUMN "output_bin_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_orders" ADD CONSTRAINT "work_orders_output_bin_id_bins_bin_id_fk" FOREIGN KEY ("output_bin_id") REFERENCES "herobm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;

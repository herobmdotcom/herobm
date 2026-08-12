ALTER TABLE "herobm_core"."backorders" ALTER COLUMN "sales_order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."backorders" ALTER COLUMN "sales_order_line_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."backorders" ADD COLUMN "demand_work_order_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."backorders" ADD COLUMN "work_order_component_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."backorders" ADD CONSTRAINT "backorders_demand_work_order_id_work_orders_work_order_id_fk" FOREIGN KEY ("demand_work_order_id") REFERENCES "herobm_core"."work_orders"("work_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."backorders" ADD CONSTRAINT "backorders_work_order_component_id_work_order_components_work_order_component_id_fk" FOREIGN KEY ("work_order_component_id") REFERENCES "herobm_core"."work_order_components"("work_order_component_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_backorders_woc_state" ON "herobm_core"."backorders" USING btree ("work_order_component_id","state_code");
CREATE INDEX "idx_bin_contents_product_id" ON "modbm_core"."bin_contents" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_entries_entry_date" ON "modbm_core"."inventory_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "idx_inventory_ledger_entry_id" ON "modbm_core"."inventory_ledger" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "idx_sales_order_lines_order_id" ON "modbm_core"."sales_order_lines" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "idx_sales_orders_customer_id" ON "modbm_core"."sales_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_sales_orders_state_code" ON "modbm_core"."sales_orders" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX "idx_sales_orders_created_on" ON "modbm_core"."sales_orders" USING btree ("created_on");
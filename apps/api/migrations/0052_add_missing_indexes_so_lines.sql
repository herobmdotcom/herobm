CREATE INDEX "idx_purchase_invoice_lines_po_line" ON "herobm_core"."purchase_invoice_lines" USING btree ("purchase_order_line_id");--> statement-breakpoint
CREATE INDEX "idx_sales_credit_note_lines_so_line" ON "herobm_core"."sales_credit_note_lines" USING btree ("sales_order_line_id");--> statement-breakpoint
CREATE INDEX "idx_sales_invoice_lines_so_line" ON "herobm_core"."sales_invoice_lines" USING btree ("sales_order_line_id");--> statement-breakpoint
CREATE INDEX "idx_sales_order_lines_parent_line" ON "herobm_core"."sales_order_lines" USING btree ("parent_line_id");--> statement-breakpoint
CREATE INDEX "idx_sales_order_return_lines_so_line" ON "herobm_core"."sales_order_return_lines" USING btree ("sales_order_line_id");--> statement-breakpoint
CREATE INDEX "idx_sales_order_shipment_lines_so_line" ON "herobm_core"."sales_order_shipment_lines" USING btree ("sales_order_line_id");
UPDATE herobm_core.sales_order_lines 
SET line_number = sub.new_line_number 
FROM (
    SELECT sales_order_line_id, ROW_NUMBER() OVER (PARTITION BY sales_order_id ORDER BY line_number, sales_order_line_id) as new_line_number 
    FROM herobm_core.sales_order_lines
) sub 
WHERE herobm_core.sales_order_lines.sales_order_line_id = sub.sales_order_line_id;--> statement-breakpoint

UPDATE herobm_core.purchase_order_lines 
SET line_number = sub.new_line_number 
FROM (
    SELECT purchase_order_line_id, ROW_NUMBER() OVER (PARTITION BY purchase_order_id ORDER BY line_number, purchase_order_line_id) as new_line_number 
    FROM herobm_core.purchase_order_lines
) sub 
WHERE herobm_core.purchase_order_lines.purchase_order_line_id = sub.purchase_order_line_id;--> statement-breakpoint

ALTER TABLE "herobm_core"."purchase_order_lines" ADD CONSTRAINT "unique_po_line_number" UNIQUE("purchase_order_id","line_number");--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_lines" ADD CONSTRAINT "unique_so_line_number" UNIQUE("sales_order_id","line_number");
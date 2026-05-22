CREATE TABLE "modbm_core"."product_components" (
	"component_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_product_id" uuid NOT NULL,
	"child_product_id" uuid NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"sequence_number" integer DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_lines" ADD COLUMN "parent_line_id" uuid;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_components" ADD CONSTRAINT "product_components_parent_product_id_products_product_id_fk" FOREIGN KEY ("parent_product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_components" ADD CONSTRAINT "product_components_child_product_id_products_product_id_fk" FOREIGN KEY ("child_product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_parent_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("parent_line_id") REFERENCES "modbm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;
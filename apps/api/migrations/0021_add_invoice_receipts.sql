CREATE TABLE IF NOT EXISTS "modbm_core"."purchase_invoice_receipts" (
	"invoice_receipt_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_line_id" uuid NOT NULL,
	"goods_received_line_id" uuid NOT NULL,
	"quantity_billed" numeric NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modbm_core"."purchase_invoice_receipts" ADD CONSTRAINT "fk_invoice_line" FOREIGN KEY ("invoice_line_id") REFERENCES "modbm_core"."purchase_invoice_lines"("invoice_line_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modbm_core"."purchase_invoice_receipts" ADD CONSTRAINT "fk_goods_received_line" FOREIGN KEY ("goods_received_line_id") REFERENCES "modbm_core"."goods_received_lines"("goods_received_line_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
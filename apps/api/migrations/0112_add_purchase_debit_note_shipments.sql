CREATE TABLE "herobm_core"."purchase_debit_note_shipments" (
	"debit_note_shipment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_line_id" uuid NOT NULL,
	"shipment_line_id" uuid NOT NULL,
	"quantity_credited" numeric NOT NULL
);
--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_note_shipments" ADD CONSTRAINT "purchase_debit_note_shipments_debit_note_line_id_purchase_debit_note_lines_debit_note_line_id_fk" FOREIGN KEY ("debit_note_line_id") REFERENCES "herobm_core"."purchase_debit_note_lines"("debit_note_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_note_shipments" ADD CONSTRAINT "purchase_debit_note_shipments_shipment_line_id_purchase_order_return_shipment_lines_shipment_line_id_fk" FOREIGN KEY ("shipment_line_id") REFERENCES "herobm_core"."purchase_order_return_shipment_lines"("shipment_line_id") ON DELETE no action ON UPDATE no action;
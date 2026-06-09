CREATE TABLE "modbm_core"."payment_lines" (
	"payment_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"gl_account_id" uuid NOT NULL,
	"amount" numeric NOT NULL,
	"memo" text
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."payment_entries" ALTER COLUMN "party_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."payment_lines" ADD CONSTRAINT "payment_lines_payment_id_payment_entries_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "modbm_core"."payment_entries"("payment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."payment_lines" ADD CONSTRAINT "payment_lines_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;
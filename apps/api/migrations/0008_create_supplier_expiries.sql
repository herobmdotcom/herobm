CREATE TABLE "modbm_core"."supplier_expiries" (
	"expiry_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"expiry_type" text NOT NULL,
	"expiry_date" date NOT NULL,
	"notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_groups" ADD COLUMN "trading_terms_id" uuid;--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_groups" ADD COLUMN "early_payment_discount" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_groups" ADD COLUMN "credit_limit" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_groups" ADD COLUMN "is_purchasing_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_groups" ADD COLUMN "purchasing_block_reason" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_groups" ADD COLUMN "is_payment_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_groups" ADD COLUMN "payment_block_reason" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_groups" ADD COLUMN "block_notes" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD COLUMN "trading_terms_id" uuid;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD COLUMN "early_payment_discount" numeric;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD COLUMN "credit_limit" numeric;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD COLUMN "is_purchasing_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD COLUMN "purchasing_block_reason" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD COLUMN "is_payment_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD COLUMN "payment_block_reason" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD COLUMN "block_notes" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_expiries" ADD CONSTRAINT "supplier_expiries_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "modbm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."supplier_groups" ADD CONSTRAINT "supplier_groups_trading_terms_id_trading_terms_trading_terms_id_fk" FOREIGN KEY ("trading_terms_id") REFERENCES "modbm_core"."trading_terms"("trading_terms_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD CONSTRAINT "suppliers_trading_terms_id_trading_terms_trading_terms_id_fk" FOREIGN KEY ("trading_terms_id") REFERENCES "modbm_core"."trading_terms"("trading_terms_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" DROP COLUMN "payment_terms";
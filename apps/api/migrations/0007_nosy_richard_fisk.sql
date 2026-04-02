CREATE TABLE "modbm_core"."trading_terms" (
	"trading_terms_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"days" integer NOT NULL,
	"type" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "trading_terms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."account_groups" ADD COLUMN "trading_terms_id" uuid;--> statement-breakpoint
ALTER TABLE "modbm_core"."account_groups" ADD COLUMN "credit_limit" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "modbm_core"."account_groups" ADD COLUMN "is_on_credit_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."accounts" ADD COLUMN "trading_terms_id" uuid;--> statement-breakpoint
ALTER TABLE "modbm_core"."accounts" ADD COLUMN "credit_limit" numeric;--> statement-breakpoint
ALTER TABLE "modbm_core"."accounts" ADD COLUMN "is_on_credit_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."app_settings" ADD COLUMN "credit_limit_behavior" text DEFAULT 'soft' NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."account_groups" ADD CONSTRAINT "account_groups_trading_terms_id_trading_terms_trading_terms_id_fk" FOREIGN KEY ("trading_terms_id") REFERENCES "modbm_core"."trading_terms"("trading_terms_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."accounts" ADD CONSTRAINT "accounts_trading_terms_id_trading_terms_trading_terms_id_fk" FOREIGN KEY ("trading_terms_id") REFERENCES "modbm_core"."trading_terms"("trading_terms_id") ON DELETE no action ON UPDATE no action;
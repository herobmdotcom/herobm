CREATE TABLE "herobm_core"."gl_fiscal_periods" (
	"period_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_name" text NOT NULL,
	"fiscal_year" integer NOT NULL,
	"period_number" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text NOT NULL,
	"locked_by" text,
	"locked_at" timestamp with time zone,
	"closed_by" text,
	"closed_at" timestamp with time zone,
	"notes" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "gl_fiscal_periods_period_name_unique" UNIQUE("period_name")
);
--> statement-breakpoint
CREATE INDEX "idx_gl_fiscal_periods_year_period" ON "herobm_core"."gl_fiscal_periods" USING btree ("fiscal_year","period_number");--> statement-breakpoint
CREATE INDEX "idx_gl_fiscal_periods_dates" ON "herobm_core"."gl_fiscal_periods" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_gl_fiscal_periods_status" ON "herobm_core"."gl_fiscal_periods" USING btree ("status");
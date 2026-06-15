CREATE TABLE "herobm_core"."tax_position_mappings" (
	"mapping_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tax_position_id" uuid NOT NULL,
	"source_tax_category_id" uuid NOT NULL,
	"destination_tax_category_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."tax_positions" (
	"tax_position_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"is_default" boolean DEFAULT false,
	CONSTRAINT "tax_positions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" DROP CONSTRAINT "customers_tax_category_id_tax_categories_tax_category_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" ADD COLUMN "tax_position_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" ADD COLUMN "tax_position_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."tax_position_mappings" ADD CONSTRAINT "tax_position_mappings_tax_position_id_tax_positions_tax_position_id_fk" FOREIGN KEY ("tax_position_id") REFERENCES "herobm_core"."tax_positions"("tax_position_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."tax_position_mappings" ADD CONSTRAINT "tax_position_mappings_source_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("source_tax_category_id") REFERENCES "herobm_core"."tax_categories"("tax_category_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."tax_position_mappings" ADD CONSTRAINT "tax_position_mappings_destination_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("destination_tax_category_id") REFERENCES "herobm_core"."tax_categories"("tax_category_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tax_position_mappings_unique_idx" ON "herobm_core"."tax_position_mappings" USING btree ("tax_position_id","source_tax_category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_positions_single_default_idx" ON "herobm_core"."tax_positions" USING btree ("is_default") WHERE "herobm_core"."tax_positions"."is_default" = true;--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" ADD CONSTRAINT "customers_tax_position_id_tax_positions_tax_position_id_fk" FOREIGN KEY ("tax_position_id") REFERENCES "herobm_core"."tax_positions"("tax_position_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" ADD CONSTRAINT "suppliers_tax_position_id_tax_positions_tax_position_id_fk" FOREIGN KEY ("tax_position_id") REFERENCES "herobm_core"."tax_positions"("tax_position_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" DROP COLUMN "tax_category_id";
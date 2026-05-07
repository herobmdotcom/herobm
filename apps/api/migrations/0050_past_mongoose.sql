CREATE TABLE "modbm_core"."discount_matrix" (
	"discount_matrix_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_group_id" uuid,
	"account_id" uuid,
	"product_group_id" uuid,
	"discount_percentage" numeric DEFAULT '0' NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "discount_matrix_group_product_unq" UNIQUE("account_group_id","product_group_id"),
	CONSTRAINT "discount_matrix_account_product_unq" UNIQUE("account_id","product_group_id"),
	CONSTRAINT "discount_matrix_owner_check" CHECK ((account_group_id IS NOT NULL AND account_id IS NULL) OR
          (account_group_id IS NULL AND account_id IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."discount_matrix" ADD CONSTRAINT "discount_matrix_account_group_id_account_groups_account_group_id_fk" FOREIGN KEY ("account_group_id") REFERENCES "modbm_core"."account_groups"("account_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."discount_matrix" ADD CONSTRAINT "discount_matrix_account_id_accounts_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "modbm_core"."accounts"("account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."discount_matrix" ADD CONSTRAINT "discount_matrix_product_group_id_product_groups_product_group_id_fk" FOREIGN KEY ("product_group_id") REFERENCES "modbm_core"."product_groups"("product_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_discount_matrix_account_group" ON "modbm_core"."discount_matrix" USING btree ("account_group_id");--> statement-breakpoint
CREATE INDEX "idx_discount_matrix_account" ON "modbm_core"."discount_matrix" USING btree ("account_id");
--> statement-breakpoint
-- Data migration: copy existing flat account_group discounts into discount_matrix (wildcard product group)
INSERT INTO "modbm_core"."discount_matrix" ("account_group_id", "product_group_id", "discount_percentage")
SELECT "account_group_id", NULL, "default_discount_percentage"
FROM "modbm_core"."account_groups"
WHERE "default_discount_percentage" IS NOT NULL
  AND "default_discount_percentage"::numeric > 0;
--> statement-breakpoint
-- Data migration: copy existing flat account discounts into discount_matrix (wildcard product group)
INSERT INTO "modbm_core"."discount_matrix" ("account_id", "product_group_id", "discount_percentage")
SELECT "account_id", NULL, "customer_discount"
FROM "modbm_core"."accounts"
WHERE "customer_discount" IS NOT NULL
  AND "customer_discount"::numeric > 0;
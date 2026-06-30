ALTER TABLE "herobm_core"."locations" RENAME COLUMN "state" TO "state_or_province";
ALTER TABLE "herobm_core"."locations" RENAME COLUMN "post_code" TO "postal_code";
ALTER TABLE "herobm_core"."locations" ADD COLUMN "address_line_2" text;

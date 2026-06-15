ALTER TABLE "herobm_core"."csv_mapping_profiles" DROP CONSTRAINT "csv_mapping_profiles_gl_account_id_gl_accounts_gl_account_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."csv_mapping_profiles" DROP COLUMN "gl_account_id";
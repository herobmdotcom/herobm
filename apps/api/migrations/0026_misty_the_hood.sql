ALTER TABLE "modbm_core"."csv_mapping_profiles" ALTER COLUMN "amount_column" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."bank_statement_lines" ADD COLUMN "type" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."bank_statement_lines" ADD COLUMN "payee" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."csv_mapping_profiles" ADD COLUMN "debit_column" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."csv_mapping_profiles" ADD COLUMN "credit_column" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."csv_mapping_profiles" ADD COLUMN "type_column" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."csv_mapping_profiles" ADD COLUMN "payee_column" text;
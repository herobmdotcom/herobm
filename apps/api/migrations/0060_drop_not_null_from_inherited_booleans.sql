ALTER TABLE "herobm_core"."customers" ALTER COLUMN "is_on_credit_hold" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" ALTER COLUMN "is_on_credit_hold" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" ALTER COLUMN "is_payment_blocked" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" ALTER COLUMN "is_payment_blocked" DROP NOT NULL;
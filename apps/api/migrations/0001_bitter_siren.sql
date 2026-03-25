ALTER TABLE "modbm_core"."products" ALTER COLUMN "list_price" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ALTER COLUMN "list_price" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ALTER COLUMN "standard_cost" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ALTER COLUMN "standard_cost" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ALTER COLUMN "trade_price" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ALTER COLUMN "trade_price" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ALTER COLUMN "price_level_3" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ALTER COLUMN "price_level_3" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ALTER COLUMN "price_level_4" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ALTER COLUMN "price_level_4" SET DEFAULT '0';
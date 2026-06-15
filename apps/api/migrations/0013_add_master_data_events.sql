-- Custom SQL migration file, put your code below! --

CREATE TABLE IF NOT EXISTS "herobm_core"."master_data_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);

ALTER TABLE "herobm_core"."outbox" RENAME COLUMN "aggregate_type" TO "entity_type";
ALTER TABLE "herobm_core"."outbox" RENAME COLUMN "aggregate_id" TO "entity_id";

DROP TABLE IF EXISTS "herobm_core"."customer_events" CASCADE;
DROP TABLE IF EXISTS "herobm_core"."order_events" CASCADE;
DROP TABLE IF EXISTS "herobm_core"."payment_events" CASCADE;
DROP TABLE IF EXISTS "herobm_core"."product_events" CASCADE;
DROP TABLE IF EXISTS "herobm_core"."product_supplier_events" CASCADE;
DROP TABLE IF EXISTS "herobm_core"."purchase_order_events" CASCADE;
DROP TABLE IF EXISTS "herobm_core"."shipment_events" CASCADE;
DROP TABLE IF EXISTS "herobm_core"."supplier_events" CASCADE;
DROP TABLE IF EXISTS "herobm_core"."transfer_order_events" CASCADE;

CREATE TABLE IF NOT EXISTS "herobm_core"."sales_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "herobm_core"."procurement_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "herobm_core"."warehouse_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "herobm_core"."financial_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "herobm_core"."inventory_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);

ALTER TABLE "herobm_core"."system_events" RENAME COLUMN "aggregate_type" TO "entity_type";
ALTER TABLE "herobm_core"."system_events" RENAME COLUMN "aggregate_id" TO "entity_id";
CREATE TABLE "herobm_core"."customer_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"first_name" text,
	"last_name" text,
	"full_name" text,
	"email" text,
	"email_secondary" text,
	"phone" text,
	"mobile" text,
	"job_title" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"source_id" text,
	"source" text DEFAULT 'app' NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."customer_delivery_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"address_name" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state_or_province" text,
	"postal_code" text,
	"country" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"source_id" text,
	"source" text DEFAULT 'app' NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" RENAME COLUMN "address1_line1" TO "billing_address_line1";--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" RENAME COLUMN "address1_line2" TO "billing_address_line2";--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" RENAME COLUMN "address1_city" TO "billing_address_city";--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" RENAME COLUMN "address1_state_or_province" TO "billing_address_state_or_province";--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" RENAME COLUMN "address1_postal_code" TO "billing_address_postal_code";--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" RENAME COLUMN "address1_country" TO "billing_address_country";--> statement-breakpoint
ALTER TABLE "herobm_core"."customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "herobm_core"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."customer_delivery_addresses" ADD CONSTRAINT "customer_delivery_addresses_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "herobm_core"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" DROP COLUMN "primary_contact_name";--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" DROP COLUMN "primary_contact_email";--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" DROP COLUMN "primary_contact_phone";
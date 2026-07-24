CREATE TABLE "herobm_core"."ext_ma_buyer_qualifications" (
	"qualification_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"buyer_activity" text,
	"business_model" text,
	"geography" text,
	"size_criteria" text,
	"financial_capacity" text,
	"strategic_fit" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."ext_ma_seller_qualifications" (
	"qualification_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"market_context" text,
	"competitive_environment" text,
	"market_trends" text,
	"added_value" text,
	"specific_clients" text,
	"business_model" text,
	"consolidation_perspectives" text,
	"interested_buyers_exist" boolean,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."ext_ma_strategic_intelligence" (
	"intelligence_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"project_id" uuid,
	"manager_intent" text,
	"sector_interests" text,
	"external_growth_projects" text,
	"future_sale_intent" text,
	"timeline" text,
	"deal_refusal_reason" text,
	"strategic_rationale" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."actor_actor_links" (
	"link_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_actor_id" uuid NOT NULL,
	"target_actor_id" uuid NOT NULL,
	"link_type" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."actor_contact_links" (
	"link_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"link_type" text DEFAULT 'employee' NOT NULL,
	"primary_for" text[],
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."actors" (
	"actor_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"legal_status" text,
	"headquarters_address" text,
	"website" text,
	"industry" text,
	"telephone" text,
	"fax" text,
	"email" text,
	"business_number" text,
	"is_tax_registered" boolean DEFAULT false NOT NULL,
	"referred_by_actor_id" uuid,
	"referred_by_contact_id" uuid,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."contacts" (
	"contact_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text,
	"last_name" text,
	"full_name" text,
	"job_title" text,
	"email" text,
	"phone" text,
	"linkedin_profile" text,
	"referred_by_actor_id" uuid,
	"referred_by_contact_id" uuid,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."project_actors" (
	"project_actor_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."projects" (
	"project_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"type" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "herobm_core"."customer_contacts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "herobm_core"."customer_contacts" CASCADE;--> statement-breakpoint


ALTER TABLE "herobm_core"."customers" ADD COLUMN "actor_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" ADD COLUMN "actor_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."ext_ma_buyer_qualifications" ADD CONSTRAINT "ext_ma_buyer_qualifications_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."ext_ma_seller_qualifications" ADD CONSTRAINT "ext_ma_seller_qualifications_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."ext_ma_strategic_intelligence" ADD CONSTRAINT "ext_ma_strategic_intelligence_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."ext_ma_strategic_intelligence" ADD CONSTRAINT "ext_ma_strategic_intelligence_contact_id_contacts_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "herobm_core"."contacts"("contact_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."ext_ma_strategic_intelligence" ADD CONSTRAINT "ext_ma_strategic_intelligence_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "herobm_core"."projects"("project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."actor_actor_links" ADD CONSTRAINT "actor_actor_links_source_actor_id_actors_actor_id_fk" FOREIGN KEY ("source_actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."actor_actor_links" ADD CONSTRAINT "actor_actor_links_target_actor_id_actors_actor_id_fk" FOREIGN KEY ("target_actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."actor_contact_links" ADD CONSTRAINT "actor_contact_links_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."actor_contact_links" ADD CONSTRAINT "actor_contact_links_contact_id_contacts_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "herobm_core"."contacts"("contact_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."contacts" ADD CONSTRAINT "contacts_referred_by_actor_id_actors_actor_id_fk" FOREIGN KEY ("referred_by_actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_actors" ADD CONSTRAINT "project_actors_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "herobm_core"."projects"("project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_actors" ADD CONSTRAINT "project_actors_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" ADD CONSTRAINT "customers_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" ADD CONSTRAINT "suppliers_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" DROP COLUMN "parent_customer_id";--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" DROP COLUMN "telephone1";--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" DROP COLUMN "fax";--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" DROP COLUMN "email_address1";--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" DROP COLUMN "business_number";--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" DROP COLUMN "is_tax_registered";--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" DROP COLUMN "telephone1";--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" DROP COLUMN "fax";--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" DROP COLUMN "email_address1";--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" DROP COLUMN "business_number";--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" DROP COLUMN "is_tax_registered";
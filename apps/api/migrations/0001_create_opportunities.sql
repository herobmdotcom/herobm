CREATE TABLE "herobm_core"."opportunities" (
	"opportunity_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_code" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"type" text NOT NULL,
	"estimated_value" numeric,
	"currency_code" text,
	"target_close_date" timestamp with time zone,
	"probability" integer,
	"actual_value" numeric,
	"description" text,
	"owner_id" uuid,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."opportunity_actors" (
	"opportunity_actor_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"roles" text[],
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."opportunity_contacts" (
	"opportunity_contact_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"roles" text[],
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."opportunity_notes" (
	"note_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_by_id" uuid,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "herobm_core"."opportunities" ADD CONSTRAINT "opportunities_owner_id_users_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."opportunity_actors" ADD CONSTRAINT "opportunity_actors_opportunity_id_opportunities_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "herobm_core"."opportunities"("opportunity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."opportunity_actors" ADD CONSTRAINT "opportunity_actors_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."opportunity_contacts" ADD CONSTRAINT "opportunity_contacts_opportunity_id_opportunities_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "herobm_core"."opportunities"("opportunity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."opportunity_contacts" ADD CONSTRAINT "opportunity_contacts_contact_id_contacts_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "herobm_core"."contacts"("contact_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."opportunity_notes" ADD CONSTRAINT "opportunity_notes_opportunity_id_opportunities_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "herobm_core"."opportunities"("opportunity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."opportunity_notes" ADD CONSTRAINT "opportunity_notes_created_by_id_users_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "herobm_core"."opportunities" ("opportunity_id", "state_code", "name", "status", "type", "owner_id", "created_on", "modified_on")
SELECT "project_id", "state_code", "name", "status", "type", "owner_id", "created_on", "modified_on"
FROM "herobm_core"."projects"
ON CONFLICT ("opportunity_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "herobm_core"."opportunity_actors" ("opportunity_actor_id", "opportunity_id", "actor_id", "roles", "created_on")
SELECT "project_actor_id", "project_id", "actor_id", "roles", "created_on"
FROM "herobm_core"."project_actors"
ON CONFLICT ("opportunity_actor_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "herobm_core"."opportunity_contacts" ("opportunity_contact_id", "opportunity_id", "contact_id", "roles", "created_on")
SELECT "project_contact_id", "project_id", "contact_id", "roles", "created_on"
FROM "herobm_core"."project_contacts"
ON CONFLICT ("opportunity_contact_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "herobm_core"."opportunity_notes" ("note_id", "opportunity_id", "content", "created_by_id", "created_on")
SELECT "note_id", "project_id", "content", "created_by_id", "created_on"
FROM "herobm_core"."project_notes"
ON CONFLICT ("note_id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_orders" ADD COLUMN IF NOT EXISTS "opportunity_id" uuid;
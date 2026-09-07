CREATE TABLE IF NOT EXISTS "herobm_core"."opportunities" (
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
CREATE TABLE IF NOT EXISTS "herobm_core"."opportunity_actors" (
	"opportunity_actor_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"roles" text[],
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "herobm_core"."opportunity_contacts" (
	"opportunity_contact_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"roles" text[],
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "herobm_core"."opportunity_notes" (
	"note_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_by_id" uuid,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "herobm_core"."crm_activities" (
	"activity_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"priority" text NOT NULL,
	"actor_id" uuid,
	"opportunity_id" uuid,
	"due_date" timestamp with time zone,
	"assigned_to_user_id" uuid,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" uuid,
	"created_by" text NOT NULL,
	"created_by_id" uuid,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "herobm_core"."crm_activity_contacts" (
	"activity_contact_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "herobm_core"."actors" ADD COLUMN IF NOT EXISTS "owner_id" uuid;
--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_orders" ADD COLUMN IF NOT EXISTS "opportunity_id" uuid;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sales_orders_opportunity_id" ON "herobm_core"."sales_orders" ("opportunity_id");
--> statement-breakpoint
DO $$
BEGIN
  -- 1. Data migration from legacy project tables if they exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'herobm_core' AND table_name = 'projects') THEN
    INSERT INTO "herobm_core"."opportunities" ("opportunity_id", "state_code", "name", "status", "type", "owner_id", "created_on", "modified_on")
    SELECT "project_id", "state_code", "name", "status", "type", "owner_id", "created_on", "modified_on"
    FROM "herobm_core"."projects"
    ON CONFLICT ("opportunity_id") DO NOTHING;

    INSERT INTO "herobm_core"."opportunity_actors" ("opportunity_actor_id", "opportunity_id", "actor_id", "roles", "created_on")
    SELECT "project_actor_id", "project_id", "actor_id", "roles", "created_on"
    FROM "herobm_core"."project_actors"
    ON CONFLICT ("opportunity_actor_id") DO NOTHING;

    INSERT INTO "herobm_core"."opportunity_contacts" ("opportunity_contact_id", "opportunity_id", "contact_id", "roles", "created_on")
    SELECT "project_contact_id", "project_id", "contact_id", "roles", "created_on"
    FROM "herobm_core"."project_contacts"
    ON CONFLICT ("opportunity_contact_id") DO NOTHING;

    INSERT INTO "herobm_core"."opportunity_notes" ("note_id", "opportunity_id", "content", "created_by_id", "created_on")
    SELECT "note_id", "project_id", "content", "created_by_id", "created_on"
    FROM "herobm_core"."project_notes"
    ON CONFLICT ("note_id") DO NOTHING;

    DROP TABLE IF EXISTS "herobm_core"."project_notes" CASCADE;
    DROP TABLE IF EXISTS "herobm_core"."project_contacts" CASCADE;
    DROP TABLE IF EXISTS "herobm_core"."project_actors" CASCADE;
    DROP TABLE IF EXISTS "herobm_core"."projects" CASCADE;
  END IF;

  -- 2. Handle crm_activities transition if project_id or contact_id column existed
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'herobm_core' AND table_name = 'crm_activities' AND column_name = 'project_id') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'herobm_core' AND table_name = 'crm_activities' AND column_name = 'opportunity_id') THEN
      ALTER TABLE "herobm_core"."crm_activities" RENAME COLUMN "project_id" TO "opportunity_id";
    ELSE
      UPDATE "herobm_core"."crm_activities" SET "opportunity_id" = "project_id" WHERE "opportunity_id" IS NULL;
      ALTER TABLE "herobm_core"."crm_activities" DROP COLUMN "project_id";
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'herobm_core' AND table_name = 'crm_activities' AND column_name = 'contact_id') THEN
    ALTER TABLE "herobm_core"."crm_activities" DROP COLUMN "contact_id";
  END IF;

  -- 3. Rename app_settings columns from project_* to opportunity_*
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'herobm_core' AND table_name = 'app_settings' AND column_name = 'project_statuses') THEN
    ALTER TABLE "herobm_core"."app_settings" RENAME COLUMN "project_statuses" TO "opportunity_stages";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'herobm_core' AND table_name = 'app_settings' AND column_name = 'project_types') THEN
    ALTER TABLE "herobm_core"."app_settings" RENAME COLUMN "project_types" TO "opportunity_types";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'herobm_core' AND table_name = 'app_settings' AND column_name = 'project_contact_roles') THEN
    ALTER TABLE "herobm_core"."app_settings" RENAME COLUMN "project_contact_roles" TO "opportunity_contact_roles";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'herobm_core' AND table_name = 'app_settings' AND column_name = 'project_actor_roles') THEN
    ALTER TABLE "herobm_core"."app_settings" RENAME COLUMN "project_actor_roles" TO "opportunity_actor_roles";
  END IF;

  -- 4. Foreign key constraints
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'opportunities_owner_id_users_user_id_fk') THEN
    ALTER TABLE "herobm_core"."opportunities" ADD CONSTRAINT "opportunities_owner_id_users_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'opportunity_actors_opportunity_id_opportunities_opportunity_id_fk') THEN
    ALTER TABLE "herobm_core"."opportunity_actors" ADD CONSTRAINT "opportunity_actors_opportunity_id_opportunities_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "herobm_core"."opportunities"("opportunity_id") ON DELETE no action ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'opportunity_actors_actor_id_actors_actor_id_fk') THEN
    ALTER TABLE "herobm_core"."opportunity_actors" ADD CONSTRAINT "opportunity_actors_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'opportunity_contacts_opportunity_id_opportunities_opportunity_id_fk') THEN
    ALTER TABLE "herobm_core"."opportunity_contacts" ADD CONSTRAINT "opportunity_contacts_opportunity_id_opportunities_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "herobm_core"."opportunities"("opportunity_id") ON DELETE no action ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'opportunity_contacts_contact_id_contacts_contact_id_fk') THEN
    ALTER TABLE "herobm_core"."opportunity_contacts" ADD CONSTRAINT "opportunity_contacts_contact_id_contacts_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "herobm_core"."contacts"("contact_id") ON DELETE no action ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'opportunity_notes_opportunity_id_opportunities_opportunity_id_fk') THEN
    ALTER TABLE "herobm_core"."opportunity_notes" ADD CONSTRAINT "opportunity_notes_opportunity_id_opportunities_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "herobm_core"."opportunities"("opportunity_id") ON DELETE no action ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'opportunity_notes_created_by_id_users_user_id_fk') THEN
    ALTER TABLE "herobm_core"."opportunity_notes" ADD CONSTRAINT "opportunity_notes_created_by_id_users_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'actors_owner_id_users_user_id_fk') THEN
    ALTER TABLE "herobm_core"."actors" ADD CONSTRAINT "actors_owner_id_users_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sales_orders_opportunity_id_opportunities_opportunity_id_fk') THEN
    ALTER TABLE "herobm_core"."sales_orders" ADD CONSTRAINT "sales_orders_opportunity_id_opportunities_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "herobm_core"."opportunities"("opportunity_id") ON DELETE no action ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'crm_activities_actor_id_actors_actor_id_fk') THEN
    ALTER TABLE "herobm_core"."crm_activities" ADD CONSTRAINT "crm_activities_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'crm_activities_opportunity_id_opportunities_opportunity_id_fk') THEN
    ALTER TABLE "herobm_core"."crm_activities" ADD CONSTRAINT "crm_activities_opportunity_id_opportunities_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "herobm_core"."opportunities"("opportunity_id") ON DELETE no action ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'crm_activities_assigned_to_user_id_users_user_id_fk') THEN
    ALTER TABLE "herobm_core"."crm_activities" ADD CONSTRAINT "crm_activities_assigned_to_user_id_users_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'crm_activities_completed_by_user_id_users_user_id_fk') THEN
    ALTER TABLE "herobm_core"."crm_activities" ADD CONSTRAINT "crm_activities_completed_by_user_id_users_user_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'crm_activities_created_by_id_users_user_id_fk') THEN
    ALTER TABLE "herobm_core"."crm_activities" ADD CONSTRAINT "crm_activities_created_by_id_users_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'crm_activity_contacts_activity_id_crm_activities_activity_id_fk') THEN
    ALTER TABLE "herobm_core"."crm_activity_contacts" ADD CONSTRAINT "crm_activity_contacts_activity_id_crm_activities_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "herobm_core"."crm_activities"("activity_id") ON DELETE cascade ON UPDATE no action;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'crm_activity_contacts_contact_id_contacts_contact_id_fk') THEN
    ALTER TABLE "herobm_core"."crm_activity_contacts" ADD CONSTRAINT "crm_activity_contacts_contact_id_contacts_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "herobm_core"."contacts"("contact_id") ON DELETE cascade ON UPDATE no action;
  END IF;

  -- 5. Clean up old migration ledger entries if they exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'herobm_core' AND table_name = 'schema_migrations') THEN
    DELETE FROM "herobm_core"."schema_migrations"
    WHERE filename IN (
      '0001_create_opportunities.sql',
      '0002_add_actors_owner_id.sql',
      '0003_add_opportunity_to_sales_orders.sql',
      '0004_add_crm_activity_contacts.sql',
      '0005_remove_legacy_projects.sql'
    );
  END IF;
END $$;

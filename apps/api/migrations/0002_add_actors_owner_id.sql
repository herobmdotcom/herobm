CREATE TABLE "herobm_core"."crm_activities" (
	"activity_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"priority" text NOT NULL,
	"actor_id" uuid,
	"contact_id" uuid,
	"project_id" uuid,
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
ALTER TABLE "herobm_core"."actors" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."crm_activities" ADD CONSTRAINT "crm_activities_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."crm_activities" ADD CONSTRAINT "crm_activities_contact_id_contacts_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "herobm_core"."contacts"("contact_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."crm_activities" ADD CONSTRAINT "crm_activities_project_id_opportunities_opportunity_id_fk" FOREIGN KEY ("project_id") REFERENCES "herobm_core"."opportunities"("opportunity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."crm_activities" ADD CONSTRAINT "crm_activities_assigned_to_user_id_users_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."crm_activities" ADD CONSTRAINT "crm_activities_completed_by_user_id_users_user_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."crm_activities" ADD CONSTRAINT "crm_activities_created_by_id_users_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."actors" ADD CONSTRAINT "actors_owner_id_users_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;
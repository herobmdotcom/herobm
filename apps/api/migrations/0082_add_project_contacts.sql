CREATE TABLE "herobm_core"."project_contacts" (
	"project_contact_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "herobm_core"."project_contacts" ADD CONSTRAINT "project_contacts_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "herobm_core"."projects"("project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_contacts" ADD CONSTRAINT "project_contacts_contact_id_contacts_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "herobm_core"."contacts"("contact_id") ON DELETE no action ON UPDATE no action;
CREATE TABLE "herobm_core"."crm_activity_contacts" (
	"activity_contact_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "herobm_core"."crm_activities" DROP CONSTRAINT "crm_activities_contact_id_contacts_contact_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."crm_activity_contacts" ADD CONSTRAINT "crm_activity_contacts_activity_id_crm_activities_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "herobm_core"."crm_activities"("activity_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."crm_activity_contacts" ADD CONSTRAINT "crm_activity_contacts_contact_id_contacts_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "herobm_core"."contacts"("contact_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "herobm_core"."crm_activity_contacts" ("activity_id", "contact_id")
SELECT "activity_id", "contact_id"
FROM "herobm_core"."crm_activities"
WHERE "contact_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."crm_activities" DROP COLUMN "contact_id";
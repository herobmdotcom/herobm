ALTER TABLE "herobm_core"."contacts" DROP CONSTRAINT "contacts_referred_by_actor_id_actors_actor_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."crm_activities" DROP CONSTRAINT "crm_activities_actor_id_actors_actor_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" DROP CONSTRAINT "customers_actor_id_actors_actor_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" DROP CONSTRAINT "suppliers_actor_id_actors_actor_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."organizations" DROP CONSTRAINT "actors_owner_id_users_user_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."organizations" DROP CONSTRAINT "actors_referred_by_actor_id_actors_actor_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."organizations" DROP CONSTRAINT "actors_referred_by_contact_id_contacts_contact_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."organization_contact_links" DROP CONSTRAINT "actor_contact_links_actor_id_actors_actor_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."organization_contact_links" DROP CONSTRAINT "actor_contact_links_contact_id_contacts_contact_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."organization_organization_links" DROP CONSTRAINT "actor_actor_links_source_actor_id_actors_actor_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."organization_organization_links" DROP CONSTRAINT "actor_actor_links_target_actor_id_actors_actor_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."opportunity_organizations" DROP CONSTRAINT "opportunity_actors_opportunity_id_opportunities_opportunity_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."opportunity_organizations" DROP CONSTRAINT "opportunity_actors_actor_id_actors_actor_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."organization_notes" DROP CONSTRAINT "actor_notes_actor_id_actors_actor_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."organization_notes" DROP CONSTRAINT "actor_notes_created_by_id_users_user_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD COLUMN "activity_types" jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."contacts" ADD CONSTRAINT "contacts_referred_by_organization_id_organizations_organization_id_fk" FOREIGN KEY ("referred_by_organization_id") REFERENCES "herobm_core"."organizations"("organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."crm_activities" ADD CONSTRAINT "crm_activities_organization_id_organizations_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "herobm_core"."organizations"("organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" ADD CONSTRAINT "customers_organization_id_organizations_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "herobm_core"."organizations"("organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" ADD CONSTRAINT "suppliers_organization_id_organizations_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "herobm_core"."organizations"("organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."organizations" ADD CONSTRAINT "organizations_owner_id_users_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."organizations" ADD CONSTRAINT "organizations_referred_by_organization_id_organizations_organization_id_fk" FOREIGN KEY ("referred_by_organization_id") REFERENCES "herobm_core"."organizations"("organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."organizations" ADD CONSTRAINT "organizations_referred_by_contact_id_contacts_contact_id_fk" FOREIGN KEY ("referred_by_contact_id") REFERENCES "herobm_core"."contacts"("contact_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."organization_contact_links" ADD CONSTRAINT "organization_contact_links_organization_id_organizations_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "herobm_core"."organizations"("organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."organization_contact_links" ADD CONSTRAINT "organization_contact_links_contact_id_contacts_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "herobm_core"."contacts"("contact_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."organization_organization_links" ADD CONSTRAINT "organization_organization_links_source_organization_id_organizations_organization_id_fk" FOREIGN KEY ("source_organization_id") REFERENCES "herobm_core"."organizations"("organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."organization_organization_links" ADD CONSTRAINT "organization_organization_links_target_organization_id_organizations_organization_id_fk" FOREIGN KEY ("target_organization_id") REFERENCES "herobm_core"."organizations"("organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."opportunity_organizations" ADD CONSTRAINT "opportunity_organizations_opportunity_id_opportunities_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "herobm_core"."opportunities"("opportunity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."opportunity_organizations" ADD CONSTRAINT "opportunity_organizations_organization_id_organizations_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "herobm_core"."organizations"("organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."organization_notes" ADD CONSTRAINT "organization_notes_organization_id_organizations_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "herobm_core"."organizations"("organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."organization_notes" ADD CONSTRAINT "organization_notes_created_by_id_users_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;
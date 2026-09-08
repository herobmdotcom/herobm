-- 1. Rename Host Organization Table to Tenant Settings
ALTER TABLE IF EXISTS "herobm_core"."organization" RENAME TO "tenant_settings";
ALTER TABLE IF EXISTS "herobm_core"."tenant_settings" RENAME COLUMN "organization_id" TO "tenant_settings_id";

-- 2. Rename CRM Actors Table to Organizations
ALTER TABLE IF EXISTS "herobm_core"."actors" RENAME TO "organizations";
ALTER TABLE IF EXISTS "herobm_core"."organizations" RENAME COLUMN "actor_id" TO "organization_id";
ALTER TABLE IF EXISTS "herobm_core"."organizations" RENAME COLUMN "referred_by_actor_id" TO "referred_by_organization_id";

-- 3. Rename Contacts FK
ALTER TABLE IF EXISTS "herobm_core"."contacts" RENAME COLUMN "referred_by_actor_id" TO "referred_by_organization_id";

-- 4. Rename Linked Entity Tables & Columns
ALTER TABLE IF EXISTS "herobm_core"."actor_contact_links" RENAME TO "organization_contact_links";
ALTER TABLE IF EXISTS "herobm_core"."organization_contact_links" RENAME COLUMN "actor_id" TO "organization_id";

ALTER TABLE IF EXISTS "herobm_core"."actor_actor_links" RENAME TO "organization_organization_links";
ALTER TABLE IF EXISTS "herobm_core"."organization_organization_links" RENAME COLUMN "source_actor_id" TO "source_organization_id";
ALTER TABLE IF EXISTS "herobm_core"."organization_organization_links" RENAME COLUMN "target_actor_id" TO "target_organization_id";

ALTER TABLE IF EXISTS "herobm_core"."opportunity_actors" RENAME TO "opportunity_organizations";
ALTER TABLE IF EXISTS "herobm_core"."opportunity_organizations" RENAME COLUMN "opportunity_actor_id" TO "opportunity_organization_id";
ALTER TABLE IF EXISTS "herobm_core"."opportunity_organizations" RENAME COLUMN "actor_id" TO "organization_id";

ALTER TABLE IF EXISTS "herobm_core"."actor_notes" RENAME TO "organization_notes";
ALTER TABLE IF EXISTS "herobm_core"."organization_notes" RENAME COLUMN "actor_id" TO "organization_id";

-- 5. Rename Customer, Supplier, and Activity References
ALTER TABLE IF EXISTS "herobm_core"."suppliers" RENAME COLUMN "actor_id" TO "organization_id";
ALTER TABLE IF EXISTS "herobm_core"."customers" RENAME COLUMN "actor_id" TO "organization_id";
ALTER TABLE IF EXISTS "herobm_core"."crm_activities" RENAME COLUMN "actor_id" TO "organization_id";

-- 6. Rename App Settings Columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'herobm_core' AND table_name = 'app_settings' AND column_name = 'actor_tags'
  ) THEN
    ALTER TABLE "herobm_core"."app_settings" RENAME COLUMN "actor_tags" TO "organization_tags";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'herobm_core' AND table_name = 'app_settings' AND column_name = 'actor_contact_roles'
  ) THEN
    ALTER TABLE "herobm_core"."app_settings" RENAME COLUMN "actor_contact_roles" TO "organization_contact_roles";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'herobm_core' AND table_name = 'app_settings' AND column_name = 'opportunity_actor_roles'
  ) THEN
    ALTER TABLE "herobm_core"."app_settings" RENAME COLUMN "opportunity_actor_roles" TO "opportunity_organization_roles";
  END IF;
END $$;

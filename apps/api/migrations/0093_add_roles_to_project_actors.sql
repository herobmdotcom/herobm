ALTER TABLE "herobm_core"."project_actors" ADD COLUMN "roles" text[];
UPDATE "herobm_core"."project_actors" SET roles = ARRAY[role] WHERE role IS NOT NULL;
ALTER TABLE "herobm_core"."project_actors" DROP COLUMN IF EXISTS "role";
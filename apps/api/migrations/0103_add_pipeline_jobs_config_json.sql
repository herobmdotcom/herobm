-- Custom SQL migration file, put your code below! --
ALTER TABLE "herobm_core"."_pipeline_jobs" ADD COLUMN "config_json" jsonb;
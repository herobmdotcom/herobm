CREATE TABLE "herobm_core"."_pipeline_jobs" (
	"job_id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"progress_json" jsonb DEFAULT '[]',
	"logs_json" jsonb DEFAULT '[]',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "herobm_core"."gl_journal_lines" ADD COLUMN IF NOT EXISTS "project_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_journal_lines" ADD COLUMN IF NOT EXISTS "project_task_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "herobm_core"."projects"("project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_project_task_id_project_tasks_project_task_id_fk" FOREIGN KEY ("project_task_id") REFERENCES "herobm_core"."project_tasks"("project_task_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gl_journal_lines_project_id" ON "herobm_core"."gl_journal_lines" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gl_journal_lines_task_id" ON "herobm_core"."gl_journal_lines" USING btree ("project_task_id");

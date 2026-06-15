ALTER TABLE "herobm_core"."pdf_template_contexts" DROP CONSTRAINT "pdf_template_contexts_template_id_pdf_templates_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."pdf_template_contexts" DROP CONSTRAINT "report_contexts_report_id_context_pk";--> statement-breakpoint
ALTER TABLE "herobm_core"."pdf_template_hooks" DROP CONSTRAINT "report_hook_assignments_pkey";--> statement-breakpoint
ALTER TABLE "herobm_core"."pdf_template_contexts" ADD CONSTRAINT "pdf_template_contexts_template_id_context_pk" PRIMARY KEY("template_id","context");--> statement-breakpoint
ALTER TABLE "herobm_core"."pdf_template_hooks" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."pdf_templates" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."pdf_templates" ADD COLUMN "context_resolver" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."pdf_template_contexts" ADD CONSTRAINT "pdf_template_contexts_template_id_pdf_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "herobm_core"."pdf_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."pdf_template_hooks" ADD CONSTRAINT "pdf_template_hooks_hook_slug_unique" UNIQUE("hook_slug");
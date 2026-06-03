ALTER TABLE "modbm_core"."reports" RENAME TO "pdf_templates";
ALTER TABLE "modbm_core"."report_contexts" RENAME TO "pdf_template_contexts";
ALTER TABLE "modbm_core"."report_hook_assignments" RENAME TO "pdf_template_hooks";
ALTER TABLE "modbm_core"."pdf_template_contexts" RENAME COLUMN "report_id" TO "template_id";
ALTER TABLE "modbm_core"."pdf_template_contexts" DROP CONSTRAINT "report_contexts_report_id_reports_id_fk";
ALTER TABLE "modbm_core"."pdf_template_hooks" DROP CONSTRAINT "report_hook_assignments_report_id_reports_id_fk";
ALTER TABLE "modbm_core"."pdf_template_contexts" ADD CONSTRAINT "pdf_template_contexts_template_id_pdf_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "modbm_core"."pdf_templates"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "modbm_core"."pdf_template_hooks" ADD CONSTRAINT "pdf_template_hooks_report_id_pdf_templates_id_fk" FOREIGN KEY ("report_id") REFERENCES "modbm_core"."pdf_templates"("id") ON DELETE cascade ON UPDATE no action;

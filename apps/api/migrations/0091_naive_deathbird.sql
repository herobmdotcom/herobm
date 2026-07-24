CREATE TABLE "herobm_core"."ext_ma_project_feedback" (
	"feedback_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"deal_proposal_reason" text,
	"deal_refusal_reason" text,
	"as_of_date" timestamp with time zone DEFAULT now(),
	"snapshot_name" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "herobm_core"."ext_ma_strategic_intelligence" DROP CONSTRAINT "ext_ma_strategic_intelligence_contact_id_contacts_contact_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."ext_ma_strategic_intelligence" DROP CONSTRAINT "ext_ma_strategic_intelligence_project_id_projects_project_id_fk";
--> statement-breakpoint
ALTER TABLE "herobm_core"."ext_ma_buyer_qualifications" ADD COLUMN "as_of_date" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "herobm_core"."ext_ma_buyer_qualifications" ADD COLUMN "snapshot_name" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."ext_ma_seller_qualifications" ADD COLUMN "as_of_date" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "herobm_core"."ext_ma_seller_qualifications" ADD COLUMN "snapshot_name" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."ext_ma_strategic_intelligence" ADD COLUMN "as_of_date" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "herobm_core"."ext_ma_strategic_intelligence" ADD COLUMN "snapshot_name" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."ext_ma_project_feedback" ADD CONSTRAINT "ext_ma_project_feedback_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "herobm_core"."projects"("project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."ext_ma_project_feedback" ADD CONSTRAINT "ext_ma_project_feedback_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."ext_ma_strategic_intelligence" DROP COLUMN "contact_id";--> statement-breakpoint
ALTER TABLE "herobm_core"."ext_ma_strategic_intelligence" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "herobm_core"."ext_ma_strategic_intelligence" DROP COLUMN "deal_refusal_reason";
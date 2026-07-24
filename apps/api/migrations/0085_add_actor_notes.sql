CREATE TABLE IF NOT EXISTS "herobm_core"."actor_notes" (
	"note_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_by_id" uuid,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "herobm_core"."actor_notes" ADD CONSTRAINT "actor_notes_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "herobm_core"."actors"("actor_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "herobm_core"."actor_notes" ADD CONSTRAINT "actor_notes_created_by_id_users_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
CREATE TABLE "modbm_core"."macros" (
	"macro_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"macro_type" text DEFAULT 'text_template' NOT NULL,
	"content" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "macros_name_unique" UNIQUE("name")
);

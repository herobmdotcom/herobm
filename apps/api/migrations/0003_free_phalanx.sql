CREATE TABLE "herobm_core"."casbin_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ptype" text NOT NULL,
	"v0" text,
	"v1" text,
	"v2" text,
	"v3" text,
	"v4" text,
	"v5" text
);

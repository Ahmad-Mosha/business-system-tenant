-- The API connects as the database owner and immediately SET ROLE prime_app.
-- A table owner bypasses row-level security; a non-owner role does not, which
-- is the whole point of the policies below.
DO $$ BEGIN
	IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'prime_app') THEN
		CREATE ROLE prime_app NOLOGIN;
	END IF;
END $$;--> statement-breakpoint
CREATE TABLE "tenant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_email" ON "app_user" USING btree ("tenant_id",lower("email"));--> statement-breakpoint
CREATE INDEX "ix_user_tenant" ON "app_user" USING btree ("tenant_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "app_user" AS PERMISSIVE FOR ALL TO "prime_app" USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO prime_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO prime_app;--> statement-breakpoint
-- Every table added by a later migration is reachable by the app role without
-- another grant, and every one of them still answers to its own RLS policy.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO prime_app;

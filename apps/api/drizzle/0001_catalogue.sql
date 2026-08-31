CREATE TABLE "channel_listing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"external_id" text NOT NULL,
	"external_variant_id" text DEFAULT '' NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_listing" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_variant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"code" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_variant" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "channel_listing" ADD CONSTRAINT "channel_listing_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_listing" ADD CONSTRAINT "channel_listing_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_listing_external" ON "channel_listing" USING btree ("tenant_id","channel","external_id","external_variant_id");--> statement-breakpoint
CREATE INDEX "ix_listing_variant" ON "channel_listing" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "ix_product_tenant" ON "product" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ix_product_category" ON "product" USING btree ("tenant_id","category");--> statement-breakpoint
CREATE INDEX "ix_variant_product" ON "product_variant" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_variant_code" ON "product_variant" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "channel_listing" AS PERMISSIVE FOR ALL TO "prime_app" USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "product" AS PERMISSIVE FOR ALL TO "prime_app" USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "product_variant" AS PERMISSIVE FOR ALL TO "prime_app" USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
ALTER TABLE "incident" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "incident" ADD COLUMN "external_source" text;--> statement-breakpoint
CREATE UNIQUE INDEX "incident_external_unique_idx" ON "incident" USING btree ("organization_id","external_source","external_id") WHERE "incident"."external_source" IS NOT NULL AND "incident"."external_id" IS NOT NULL;
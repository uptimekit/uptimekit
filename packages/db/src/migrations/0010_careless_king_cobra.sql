ALTER TABLE "incident" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "incident" ADD COLUMN "external_source" text;--> statement-breakpoint
CREATE INDEX "incident_external_idx" ON "incident" USING btree ("organization_id","external_source","external_id");
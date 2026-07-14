DROP INDEX "monitor_organization_idx";--> statement-breakpoint
ALTER TABLE "integration_config" ADD COLUMN "enabled_events" json;--> statement-breakpoint
CREATE INDEX "monitor_organization_created_idx" ON "monitor" USING btree ("organization_id","created_at","id");
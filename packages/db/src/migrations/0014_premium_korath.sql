ALTER TABLE "organization" ADD COLUMN "active_monitor_limit" integer;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "regions_per_monitor_limit" integer;--> statement-breakpoint
ALTER TABLE "monitor" ADD COLUMN "pause_reason" text;
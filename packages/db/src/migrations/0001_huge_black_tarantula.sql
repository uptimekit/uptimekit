CREATE TABLE "monitor_change" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"location" varchar(50)
);
--> statement-breakpoint
DROP INDEX "monitor_event_monitorId_idx";--> statement-breakpoint
ALTER TABLE "monitor_event" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "monitor_event" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "monitor_event" ALTER COLUMN "monitor_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "monitor_event" ALTER COLUMN "status" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "monitor_event" ALTER COLUMN "location" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "monitor_change" ADD CONSTRAINT "monitor_change_monitor_id_monitor_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "monitor_change_monitor_idx" ON "monitor_change" USING btree ("monitor_id");--> statement-breakpoint
CREATE INDEX "monitor_change_timestamp_idx" ON "monitor_change" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "monitor_event_monitor_idx" ON "monitor_event" USING btree ("monitor_id");--> statement-breakpoint
ALTER TABLE "monitor_event" DROP COLUMN "error_detail";--> statement-breakpoint
ALTER TABLE "monitor_event" DROP COLUMN "response_headers";--> statement-breakpoint
ALTER TABLE "monitor_event" DROP COLUMN "response_body";
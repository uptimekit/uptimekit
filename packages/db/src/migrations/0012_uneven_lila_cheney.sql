CREATE TABLE IF NOT EXISTS "incident_status_page" (
	"incident_id" text NOT NULL,
	"status_page_id" text NOT NULL,
	CONSTRAINT "incident_status_page_incident_id_status_page_id_pk" PRIMARY KEY("incident_id","status_page_id")
);
--> statement-breakpoint
ALTER TABLE "incident" ADD COLUMN IF NOT EXISTS "started_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "incident" ADD COLUMN IF NOT EXISTS "ended_at" timestamp;--> statement-breakpoint
UPDATE "incident" SET "started_at" = "created_at" WHERE "started_at" IS NULL;--> statement-breakpoint
UPDATE "incident" SET "ended_at" = "resolved_at" WHERE "ended_at" IS NULL AND "resolved_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "incident_status_page" DROP CONSTRAINT IF EXISTS "incident_status_page_incident_id_incident_id_fk";--> statement-breakpoint
ALTER TABLE "incident_status_page" ADD CONSTRAINT "incident_status_page_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_status_page" DROP CONSTRAINT IF EXISTS "incident_status_page_status_page_id_status_page_id_fk";--> statement-breakpoint
ALTER TABLE "incident_status_page" ADD CONSTRAINT "incident_status_page_status_page_id_status_page_id_fk" FOREIGN KEY ("status_page_id") REFERENCES "public"."status_page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incident_status_page_incident_idx" ON "incident_status_page" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incident_status_page_status_page_idx" ON "incident_status_page" USING btree ("status_page_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incident_started_at_idx" ON "incident" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incident_ended_at_idx" ON "incident" USING btree ("ended_at");

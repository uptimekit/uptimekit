ALTER TABLE "incident" ADD COLUMN "planned_end_at" timestamp;
--> statement-breakpoint
INSERT INTO "incident" (
	"id",
	"organization_id",
	"title",
	"description",
	"status",
	"severity",
	"type",
	"started_at",
	"planned_end_at",
	"ended_at",
	"created_at",
	"updated_at",
	"resolved_at"
)
SELECT
	"id",
	"organization_id",
	"title",
	"description",
	CASE
		WHEN "status" = 'completed' THEN 'resolved'
		WHEN "status" = 'in_progress' THEN 'monitoring'
		ELSE 'investigating'
	END,
	'maintenance',
	'manual',
	"start_at",
	"end_at",
	CASE WHEN "status" = 'completed' THEN "end_at" ELSE NULL END,
	"created_at",
	"updated_at",
	CASE WHEN "status" = 'completed' THEN "end_at" ELSE NULL END
FROM "maintenance"
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "incident_monitor" ("incident_id", "monitor_id")
SELECT "maintenance_id", "monitor_id"
FROM "maintenance_monitor"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "incident_status_page" ("incident_id", "status_page_id")
SELECT "maintenance_id", "status_page_id"
FROM "maintenance_status_page"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "incident_activity" ("id", "incident_id", "message", "type", "created_at", "user_id")
SELECT "id", "maintenance_id", "message", 'comment', "created_at", NULL
FROM "maintenance_update"
ON CONFLICT ("id") DO NOTHING;

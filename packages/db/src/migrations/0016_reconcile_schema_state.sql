ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "active_monitor_limit" integer;
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "regions_per_monitor_limit" integer;
--> statement-breakpoint
ALTER TABLE "monitor" ADD COLUMN IF NOT EXISTS "pause_reason" text;
--> statement-breakpoint
ALTER TABLE "monitor" ADD COLUMN IF NOT EXISTS "worker_ids" json NOT NULL DEFAULT '[]'::json;
--> statement-breakpoint
WITH missing_locations AS (
	SELECT DISTINCT location.location
	FROM "monitor" AS m
	CROSS JOIN LATERAL json_array_elements_text(m."locations") AS location(location)
	LEFT JOIN "worker" AS w ON w."location" = location.location
	WHERE w."id" IS NULL
)
INSERT INTO "worker" (
	"id",
	"name",
	"location",
	"active",
	"created_at",
	"updated_at"
)
SELECT
	substring(hash FROM 1 FOR 8) || '-' ||
	substring(hash FROM 9 FOR 4) || '-' ||
	substring(hash FROM 13 FOR 4) || '-' ||
	substring(hash FROM 17 FOR 4) || '-' ||
	substring(hash FROM 21 FOR 12),
	'Migrated ' || location || ' worker',
	location,
	false,
	now(),
	now()
FROM (
	SELECT
		location,
		md5('uptimekit:migrated-worker:' || location) AS hash
	FROM missing_locations
) AS generated_workers
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "monitor" AS m
SET "worker_ids" = COALESCE((
	SELECT json_agg(w."id" ORDER BY location.ordinality)
	FROM json_array_elements_text(m."locations") WITH ORDINALITY AS location(location, ordinality)
	INNER JOIN "worker" AS w ON w."location" = location.location
), '[]'::json)
WHERE COALESCE(json_array_length(m."worker_ids"), 0) = 0
	AND COALESCE(json_array_length(m."locations"), 0) > 0;
--> statement-breakpoint
ALTER TABLE "worker" DROP CONSTRAINT IF EXISTS "worker_location_unique";
--> statement-breakpoint
ALTER TABLE "monitor" ALTER COLUMN "worker_ids" DROP DEFAULT;

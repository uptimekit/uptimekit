ALTER TABLE "monitor" ADD COLUMN "worker_ids" json NOT NULL DEFAULT '[]'::json;
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
) AS generated_workers;
--> statement-breakpoint
UPDATE "monitor" AS m
SET
	"worker_ids" = COALESCE((
		SELECT json_agg(w."id" ORDER BY location.ordinality)
		FROM json_array_elements_text(m."locations") WITH ORDINALITY AS location(location, ordinality)
		INNER JOIN "worker" AS w ON w."location" = location.location
	), '[]'::json),
	"locations" = COALESCE((
		SELECT json_agg(w."location" ORDER BY location.ordinality)
		FROM json_array_elements_text(m."locations") WITH ORDINALITY AS location(location, ordinality)
		INNER JOIN "worker" AS w ON w."location" = location.location
	), '[]'::json);
--> statement-breakpoint
ALTER TABLE "worker" DROP CONSTRAINT "worker_location_unique";
--> statement-breakpoint
ALTER TABLE "monitor" ALTER COLUMN "worker_ids" DROP DEFAULT;

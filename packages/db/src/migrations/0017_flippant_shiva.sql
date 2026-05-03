CREATE TABLE "monitor_notification" (
	"monitor_id" text NOT NULL,
	"integration_config_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "monitor_notification_monitor_id_integration_config_id_pk" PRIMARY KEY("monitor_id","integration_config_id")
);
--> statement-breakpoint
ALTER TABLE "integration_config" ADD COLUMN "name" text;--> statement-breakpoint
UPDATE "integration_config"
SET "name" = CASE
	WHEN "type" = 'webhook' THEN 'Webhook'
	WHEN "type" = 'discord' THEN 'Discord'
	WHEN "type" = 'telegram' THEN 'Telegram'
	WHEN "type" = 'alertmanager' THEN 'Prometheus AlertManager'
	ELSE "type"
END
WHERE "name" IS NULL;--> statement-breakpoint
ALTER TABLE "integration_config" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_config" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "integration_config" SET "is_default" = true WHERE "active" = true;--> statement-breakpoint
ALTER TABLE "monitor_notification" ADD CONSTRAINT "monitor_notification_monitor_id_monitor_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_notification" ADD CONSTRAINT "monitor_notification_integration_config_id_integration_config_id_fk" FOREIGN KEY ("integration_config_id") REFERENCES "public"."integration_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "monitor_notification_monitor_idx" ON "monitor_notification" USING btree ("monitor_id");--> statement-breakpoint
CREATE INDEX "monitor_notification_config_idx" ON "monitor_notification" USING btree ("integration_config_id");--> statement-breakpoint
INSERT INTO "monitor_notification" ("monitor_id", "integration_config_id")
SELECT "monitor"."id", "integration_config"."id"
FROM "monitor"
INNER JOIN "integration_config"
	ON "integration_config"."organization_id" = "monitor"."organization_id"
WHERE "integration_config"."active" = true
ON CONFLICT DO NOTHING;

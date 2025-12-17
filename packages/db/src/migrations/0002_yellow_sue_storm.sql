CREATE TABLE "incident_monitor" (
	"incident_id" text NOT NULL,
	"monitor_id" text NOT NULL,
	CONSTRAINT "incident_monitor_incident_id_monitor_id_pk" PRIMARY KEY("incident_id","monitor_id")
);
--> statement-breakpoint
CREATE TABLE "integration_config" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"type" text NOT NULL,
	"config" json NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_update" (
	"id" text PRIMARY KEY NOT NULL,
	"maintenance_id" text NOT NULL,
	"message" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "incident_activity" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "monitor_change" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "monitor_change" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "monitor_change" ALTER COLUMN "monitor_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "monitor_event" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "monitor_event" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "monitor_event" ALTER COLUMN "monitor_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "incident" ADD COLUMN "type" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "incident_activity" ADD COLUMN "type" text DEFAULT 'comment' NOT NULL;--> statement-breakpoint
ALTER TABLE "status_page_monitor" ADD COLUMN "style" text DEFAULT 'history' NOT NULL;--> statement-breakpoint
ALTER TABLE "incident_monitor" ADD CONSTRAINT "incident_monitor_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_monitor" ADD CONSTRAINT "incident_monitor_monitor_id_monitor_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_config" ADD CONSTRAINT "integration_config_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_update" ADD CONSTRAINT "maintenance_update_maintenance_id_maintenance_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incident_monitor_incident_idx" ON "incident_monitor" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "incident_monitor_monitor_idx" ON "incident_monitor" USING btree ("monitor_id");--> statement-breakpoint
CREATE INDEX "integration_config_org_idx" ON "integration_config" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "integration_config_type_idx" ON "integration_config" USING btree ("type");--> statement-breakpoint
CREATE INDEX "maintenance_update_maintenanceId_idx" ON "maintenance_update" USING btree ("maintenance_id");
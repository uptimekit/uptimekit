CREATE TABLE "app_event_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"organization_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp DEFAULT now() NOT NULL,
	"locked_at" timestamp,
	"locked_by" text,
	"processed_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_event_outbox" ADD CONSTRAINT "app_event_outbox_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "app_event_outbox_ready_idx" ON "app_event_outbox" USING btree ("status","available_at");
--> statement-breakpoint
CREATE INDEX "app_event_outbox_locked_idx" ON "app_event_outbox" USING btree ("status","locked_at");
--> statement-breakpoint
CREATE INDEX "app_event_outbox_organization_idx" ON "app_event_outbox" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "app_event_outbox_created_idx" ON "app_event_outbox" USING btree ("created_at");

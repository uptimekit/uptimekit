CREATE TABLE "incident_status_page" (
	"incident_id" text NOT NULL,
	"status_page_id" text NOT NULL,
	CONSTRAINT "incident_status_page_incident_id_status_page_id_pk" PRIMARY KEY("incident_id","status_page_id")
);
--> statement-breakpoint
ALTER TABLE "incident" ADD COLUMN "started_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "incident" ADD COLUMN "ended_at" timestamp;--> statement-breakpoint
ALTER TABLE "incident_status_page" ADD CONSTRAINT "incident_status_page_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_status_page" ADD CONSTRAINT "incident_status_page_status_page_id_status_page_id_fk" FOREIGN KEY ("status_page_id") REFERENCES "public"."status_page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incident_status_page_incident_idx" ON "incident_status_page" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "incident_status_page_status_page_idx" ON "incident_status_page" USING btree ("status_page_id");--> statement-breakpoint
CREATE INDEX "incident_started_at_idx" ON "incident" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "incident_ended_at_idx" ON "incident" USING btree ("ended_at");
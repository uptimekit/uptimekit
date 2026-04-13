CREATE TABLE "status_page_email_subscribers" (
	"email" text PRIMARY KEY NOT NULL,
	"status_page_id" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "worker" DROP CONSTRAINT "worker_location_unique";--> statement-breakpoint
ALTER TABLE "monitor" ADD COLUMN "worker_ids" json NOT NULL;--> statement-breakpoint
ALTER TABLE "status_page_email_subscribers" ADD CONSTRAINT "status_page_email_subscribers_status_page_id_status_page_id_fk" FOREIGN KEY ("status_page_id") REFERENCES "public"."status_page"("id") ON DELETE cascade ON UPDATE no action;
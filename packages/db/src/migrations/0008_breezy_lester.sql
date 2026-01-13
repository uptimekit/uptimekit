CREATE TABLE "ssl_certificate_notification" (
	"id" text PRIMARY KEY NOT NULL,
	"monitor_id" text NOT NULL,
	"domain" text NOT NULL,
	"last_notified_at" timestamp NOT NULL,
	"days_until_expiry_at_notification" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ssl_certificate_notification" ADD CONSTRAINT "ssl_certificate_notification_monitor_id_monitor_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ssl_cert_notification_monitor_idx" ON "ssl_certificate_notification" USING btree ("monitor_id");--> statement-breakpoint
CREATE INDEX "ssl_cert_notification_domain_idx" ON "ssl_certificate_notification" USING btree ("domain");
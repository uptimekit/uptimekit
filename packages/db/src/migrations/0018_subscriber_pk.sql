ALTER TABLE "status_page_email_subscribers" DROP CONSTRAINT "status_page_email_subscribers_pkey";
--> statement-breakpoint
ALTER TABLE "status_page_email_subscribers" ADD CONSTRAINT "status_page_email_subscribers_pkey" PRIMARY KEY ("status_page_id","email");
--> statement-breakpoint
CREATE INDEX "status_page_email_subscribers_page_id_idx" ON "status_page_email_subscribers" USING btree ("status_page_id");

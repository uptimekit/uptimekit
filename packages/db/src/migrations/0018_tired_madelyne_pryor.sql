/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'status_page_email_subscribers'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

-- ALTER TABLE "status_page_email_subscribers" DROP CONSTRAINT "<constraint_name>";--> statement-breakpoint
ALTER TABLE "status_page_email_subscribers" ADD CONSTRAINT "status_page_email_subscribers_status_page_id_email_pk" PRIMARY KEY("status_page_id","email");--> statement-breakpoint
CREATE INDEX "status_page_email_subscribers_page_id_idx" ON "status_page_email_subscribers" USING btree ("status_page_id");
ALTER TABLE "status_page_group" ADD COLUMN "collapsible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "status_page_group" ADD COLUMN "default_collapsed" boolean DEFAULT false NOT NULL;

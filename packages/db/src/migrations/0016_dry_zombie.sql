ALTER TABLE "worker" DROP CONSTRAINT "worker_location_unique";--> statement-breakpoint
ALTER TABLE "monitor" ADD COLUMN "worker_ids" json NOT NULL;
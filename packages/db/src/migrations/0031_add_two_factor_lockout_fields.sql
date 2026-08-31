ALTER TABLE "twoFactor" ADD COLUMN "failed_verification_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "twoFactor" ADD COLUMN "locked_until" timestamp;
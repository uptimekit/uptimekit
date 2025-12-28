CREATE TABLE "worker_api_key" (
	"id" text PRIMARY KEY NOT NULL,
	"key_hash" text NOT NULL,
	"key_hint" text NOT NULL,
	"worker_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	CONSTRAINT "worker_api_key_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "worker" DROP CONSTRAINT "worker_api_key_id_apikey_id_fk";
--> statement-breakpoint
ALTER TABLE "worker_api_key" ADD CONSTRAINT "worker_api_key_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "worker_api_key_hash_idx" ON "worker_api_key" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "worker_api_key_worker_id_idx" ON "worker_api_key" USING btree ("worker_id");--> statement-breakpoint
ALTER TABLE "worker" DROP COLUMN "api_key_id";
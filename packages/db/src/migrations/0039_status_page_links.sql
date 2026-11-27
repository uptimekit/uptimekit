CREATE TABLE "status_page_link" (
	"status_page_id" text NOT NULL,
	"linked_status_page_id" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "status_page_link_status_page_id_linked_status_page_id_pk" PRIMARY KEY("status_page_id","linked_status_page_id")
);
--> statement-breakpoint
ALTER TABLE "status_page_link" ADD CONSTRAINT "status_page_link_status_page_id_status_page_id_fk" FOREIGN KEY ("status_page_id") REFERENCES "public"."status_page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page_link" ADD CONSTRAINT "status_page_link_linked_status_page_id_status_page_id_fk" FOREIGN KEY ("linked_status_page_id") REFERENCES "public"."status_page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "status_page_link_linkedId_idx" ON "status_page_link" USING btree ("linked_status_page_id");
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apikey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"start" text,
	"prefix" text,
	"key" text NOT NULL,
	"user_id" text NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp,
	"enabled" boolean DEFAULT true,
	"rate_limit_enabled" boolean DEFAULT true,
	"rate_limit_time_window" integer DEFAULT 86400000,
	"rate_limit_max" integer DEFAULT 10,
	"request_count" integer DEFAULT 0,
	"remaining" integer,
	"last_request" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"permissions" text,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"severity" text DEFAULT 'major' NOT NULL,
	"acknowledged_at" timestamp,
	"acknowledged_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "incident_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"incident_id" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_monitor" (
	"maintenance_id" text NOT NULL,
	"monitor_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_status_page" (
	"maintenance_id" text NOT NULL,
	"status_page_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitor" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"group_id" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"interval" integer DEFAULT 60 NOT NULL,
	"timeout" integer DEFAULT 30 NOT NULL,
	"incident_pending_duration" integer DEFAULT 0 NOT NULL,
	"incident_recovery_duration" integer DEFAULT 0 NOT NULL,
	"locations" json NOT NULL,
	"config" json NOT NULL,
	"success_statuses" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitor_event" (
	"id" text PRIMARY KEY NOT NULL,
	"monitor_id" text NOT NULL,
	"status" text NOT NULL,
	"latency" integer NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"status_code" integer,
	"error" text,
	"error_detail" json,
	"response_headers" json,
	"response_body" text,
	"location" text
);
--> statement-breakpoint
CREATE TABLE "monitor_group" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_page" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"domain" text,
	"description" text,
	"public" boolean DEFAULT true NOT NULL,
	"password" text,
	"design" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "status_page_slug_unique" UNIQUE("slug"),
	CONSTRAINT "status_page_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "status_page_group" (
	"id" text PRIMARY KEY NOT NULL,
	"status_page_id" text NOT NULL,
	"name" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_page_monitor" (
	"status_page_id" text NOT NULL,
	"monitor_id" text NOT NULL,
	"group_id" text,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_page_report" (
	"id" text PRIMARY KEY NOT NULL,
	"status_page_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"severity" text DEFAULT 'major' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_page_report_monitor" (
	"report_id" text NOT NULL,
	"monitor_id" text NOT NULL,
	"status" text
);
--> statement-breakpoint
CREATE TABLE "status_page_report_update" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"message" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "worker" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"api_key_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"last_heartbeat" timestamp,
	"version" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "worker_location_unique" UNIQUE("location")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_acknowledged_by_user_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_activity" ADD CONSTRAINT "incident_activity_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_activity" ADD CONSTRAINT "incident_activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_monitor" ADD CONSTRAINT "maintenance_monitor_maintenance_id_maintenance_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_monitor" ADD CONSTRAINT "maintenance_monitor_monitor_id_monitor_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_status_page" ADD CONSTRAINT "maintenance_status_page_maintenance_id_maintenance_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_status_page" ADD CONSTRAINT "maintenance_status_page_status_page_id_status_page_id_fk" FOREIGN KEY ("status_page_id") REFERENCES "public"."status_page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor" ADD CONSTRAINT "monitor_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor" ADD CONSTRAINT "monitor_group_id_monitor_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."monitor_group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_event" ADD CONSTRAINT "monitor_event_monitor_id_monitor_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_group" ADD CONSTRAINT "monitor_group_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page" ADD CONSTRAINT "status_page_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page_group" ADD CONSTRAINT "status_page_group_status_page_id_status_page_id_fk" FOREIGN KEY ("status_page_id") REFERENCES "public"."status_page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page_monitor" ADD CONSTRAINT "status_page_monitor_status_page_id_status_page_id_fk" FOREIGN KEY ("status_page_id") REFERENCES "public"."status_page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page_monitor" ADD CONSTRAINT "status_page_monitor_monitor_id_monitor_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page_monitor" ADD CONSTRAINT "status_page_monitor_group_id_status_page_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."status_page_group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page_report" ADD CONSTRAINT "status_page_report_status_page_id_status_page_id_fk" FOREIGN KEY ("status_page_id") REFERENCES "public"."status_page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page_report_monitor" ADD CONSTRAINT "status_page_report_monitor_report_id_status_page_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."status_page_report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page_report_monitor" ADD CONSTRAINT "status_page_report_monitor_monitor_id_monitor_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page_report_update" ADD CONSTRAINT "status_page_report_update_report_id_status_page_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."status_page_report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page_report_update" ADD CONSTRAINT "status_page_report_update_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker" ADD CONSTRAINT "worker_api_key_id_apikey_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."apikey"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "apikey_key_idx" ON "apikey" USING btree ("key");--> statement-breakpoint
CREATE INDEX "apikey_userId_idx" ON "apikey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "incident_organization_idx" ON "incident" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "incident_status_idx" ON "incident" USING btree ("status");--> statement-breakpoint
CREATE INDEX "incident_activity_incidentId_idx" ON "incident_activity" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "maintenance_organizationId_idx" ON "maintenance" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "maintenance_status_idx" ON "maintenance" USING btree ("status");--> statement-breakpoint
CREATE INDEX "maintenance_startAt_idx" ON "maintenance" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "maintenance_endAt_idx" ON "maintenance" USING btree ("end_at");--> statement-breakpoint
CREATE INDEX "maintenance_monitor_maintenanceId_idx" ON "maintenance_monitor" USING btree ("maintenance_id");--> statement-breakpoint
CREATE INDEX "maintenance_monitor_monitorId_idx" ON "maintenance_monitor" USING btree ("monitor_id");--> statement-breakpoint
CREATE INDEX "maintenance_status_page_maintenanceId_idx" ON "maintenance_status_page" USING btree ("maintenance_id");--> statement-breakpoint
CREATE INDEX "maintenance_status_page_statusPageId_idx" ON "maintenance_status_page" USING btree ("status_page_id");--> statement-breakpoint
CREATE INDEX "monitor_organization_idx" ON "monitor" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "monitor_active_idx" ON "monitor" USING btree ("active");--> statement-breakpoint
CREATE INDEX "monitor_group_idx" ON "monitor" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "monitor_event_monitorId_idx" ON "monitor_event" USING btree ("monitor_id");--> statement-breakpoint
CREATE INDEX "monitor_event_timestamp_idx" ON "monitor_event" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "monitor_group_organization_idx" ON "monitor_group" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "status_page_organization_idx" ON "status_page" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "status_page_slug_idx" ON "status_page" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "status_page_domain_idx" ON "status_page" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "status_page_group_pageId_idx" ON "status_page_group" USING btree ("status_page_id");--> statement-breakpoint
CREATE INDEX "status_page_monitor_pageId_idx" ON "status_page_monitor" USING btree ("status_page_id");--> statement-breakpoint
CREATE INDEX "status_page_monitor_monitorId_idx" ON "status_page_monitor" USING btree ("monitor_id");--> statement-breakpoint
CREATE INDEX "status_page_report_pageId_idx" ON "status_page_report" USING btree ("status_page_id");--> statement-breakpoint
CREATE INDEX "status_page_report_status_idx" ON "status_page_report" USING btree ("status");--> statement-breakpoint
CREATE INDEX "status_page_report_monitor_reportId_idx" ON "status_page_report_monitor" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "status_page_report_monitor_monitorId_idx" ON "status_page_report_monitor" USING btree ("monitor_id");--> statement-breakpoint
CREATE INDEX "status_page_report_update_reportId_idx" ON "status_page_report_update" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "worker_location_idx" ON "worker" USING btree ("location");--> statement-breakpoint
CREATE INDEX "worker_active_idx" ON "worker" USING btree ("active");
CREATE TABLE "organization_oidc_provider" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"issuer" text NOT NULL,
	"discovery_url" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text NOT NULL,
	"domains" json NOT NULL,
	"scopes" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_oidc_provider" ADD CONSTRAINT "organization_oidc_provider_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_oidc_provider_organization_idx" ON "organization_oidc_provider" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_oidc_provider_enabled_idx" ON "organization_oidc_provider" USING btree ("enabled");
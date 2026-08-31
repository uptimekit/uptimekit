ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "account"
SET "issuer" = CASE
    WHEN "provider_id" = 'credential' THEN 'local:credential'
    WHEN "provider_id" = 'siwe' THEN 'local:siwe'
    ELSE 'local:oauth:' || replace(replace("provider_id", '%', '%25'), '/', '%2F')
END
WHERE "issuer" IS NULL;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "account" USING btree ("issuer","account_id");

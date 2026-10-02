DO $migration$
DECLARE
    duplicate_identities text;
BEGIN
    SELECT string_agg(
        format(
            'provider_id=%s, account_id=%s, account_rows=%s',
            duplicate_group."provider_id",
            duplicate_group."account_id",
            array_to_string(duplicate_group.account_rows, ', ')
        ),
        E'\n'
    )
    INTO duplicate_identities
    FROM (
        SELECT
            "provider_id",
            "account_id",
            array_agg(
                format('%s (user_id=%s)', "id", "user_id")
                ORDER BY "id"
            ) AS account_rows
        FROM "account"
        GROUP BY "provider_id", "account_id"
        HAVING COUNT(*) > 1
    ) AS duplicate_group;

    IF duplicate_identities IS NOT NULL THEN
        RAISE EXCEPTION USING
            MESSAGE = 'Better Auth account identity migration found duplicate (provider_id, account_id) values.',
            DETAIL = duplicate_identities,
            HINT = 'Resolve each duplicate account row manually, then rerun this migration.';
    END IF;
END
$migration$;--> statement-breakpoint
CREATE UNIQUE INDEX "account_providerId_accountId_uidx" ON "account" USING btree ("provider_id","account_id");

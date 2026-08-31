ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
DO $migration$
DECLARE
    account_row RECORD;
    byte_hex text;
    char_value text;
    encoded_issuer text;
    encoded_provider_id text;
    duplicate_identities text;
    char_position integer;
BEGIN
    FOR account_row IN
        SELECT "id", "provider_id"
        FROM "account"
        WHERE "issuer" IS NULL
    LOOP
        IF account_row."provider_id" = 'credential' THEN
            encoded_issuer := 'local:credential';
        ELSIF account_row."provider_id" = 'siwe' THEN
            encoded_issuer := 'local:siwe';
        ELSE
            encoded_provider_id := '';

            IF char_length(account_row."provider_id") > 0 THEN
                FOR char_position IN 1..char_length(account_row."provider_id") LOOP
                    char_value := substr(
                        account_row."provider_id",
                        char_position,
                        1
                    );

                    IF char_value ~ '^[A-Za-z0-9._!~*''()-]$' THEN
                        encoded_provider_id := encoded_provider_id || char_value;
                    ELSE
                        byte_hex := encode(
                            convert_to(char_value, 'UTF8'),
                            'hex'
                        );

                        WHILE byte_hex <> '' LOOP
                            encoded_provider_id := encoded_provider_id || '%' || upper(
                                substr(byte_hex, 1, 2)
                            );
                            byte_hex := substr(byte_hex, 3);
                        END LOOP;
                    END IF;
                END LOOP;
            END IF;

            encoded_issuer := 'local:oauth:' || encoded_provider_id;
        END IF;

        UPDATE "account"
        SET "issuer" = encoded_issuer
        WHERE "id" = account_row."id";
    END LOOP;

    SELECT string_agg(
        format(
            'issuer=%s, account_id=%s, account_rows=%s',
            duplicate_group."issuer",
            duplicate_group."account_id",
            array_to_string(duplicate_group.account_rows, ', ')
        ),
        E'\n'
    )
    INTO duplicate_identities
    FROM (
        SELECT
            "issuer",
            "account_id",
            array_agg(
                format('%s (user_id=%s)', "id", "user_id")
                ORDER BY "id"
            ) AS account_rows
        FROM "account"
        GROUP BY "issuer", "account_id"
        HAVING COUNT(*) > 1
    ) AS duplicate_group;

    IF duplicate_identities IS NOT NULL THEN
        RAISE EXCEPTION USING
            MESSAGE = 'Better Auth 1.7 account identity migration found duplicate (issuer, account_id) values.',
            DETAIL = duplicate_identities,
            HINT = 'Resolve each duplicate account row manually, then rerun this migration.';
    END IF;
END
$migration$;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "account" USING btree ("issuer","account_id");

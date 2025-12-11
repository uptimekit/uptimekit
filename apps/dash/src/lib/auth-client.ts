import type { auth } from "@uptimekit/auth";
import { createAuthClient } from "better-auth/react";
import { adminClient, apiKeyClient, organizationClient } from "better-auth/client/plugins"


export const authClient = createAuthClient({
    plugins: [adminClient(), apiKeyClient(), organizationClient()]
});

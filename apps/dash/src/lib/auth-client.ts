import {
	adminClient,
	apiKeyClient,
	organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	plugins: [adminClient(), apiKeyClient(), organizationClient()],
});

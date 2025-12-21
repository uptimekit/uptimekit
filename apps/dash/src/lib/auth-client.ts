import {
	adminClient,
	apiKeyClient,
	organizationClient,
	twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	plugins: [
		adminClient(),
		apiKeyClient(),
		organizationClient(),
		twoFactorClient({
			onTwoFactorRedirect: () => {
				window.location.href = "/two-factor";
			},
		}),
	],
});

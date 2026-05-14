import { apiKeyClient } from "@better-auth/api-key/client";
import type { BetterAuthClientPlugin } from "better-auth/client";
import {
	adminClient,
	organizationClient,
	twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const apiKeyPlugin = apiKeyClient() as unknown as BetterAuthClientPlugin;

const authClientPlugins = [
	apiKeyPlugin,
	adminClient(),
	organizationClient(),
	twoFactorClient({
		onTwoFactorRedirect: () => {
			window.location.href = "/two-factor";
		},
	}),
] as const;

type AuthClientResponse<TData> = Promise<
	| {
			data: TData;
			error: null;
	  }
	| {
			data: null;
			error: { message: string };
	  }
>;

type ApiKeyClientMethods = {
	apiKey: {
		create: (
			data: Record<string, unknown>,
			options?: unknown,
		) => AuthClientResponse<unknown>;
		delete: (
			data: Record<string, unknown>,
			options?: unknown,
		) => AuthClientResponse<unknown>;
		list: (
			data?: { query?: Record<string, unknown> },
			options?: unknown,
		) => AuthClientResponse<{ apiKeys: unknown[] }>;
		update: (
			data: Record<string, unknown>,
			options?: unknown,
		) => AuthClientResponse<unknown>;
	};
};

const baseAuthClient = createAuthClient({
	plugins: [...authClientPlugins],
});

export const authClient = baseAuthClient as typeof baseAuthClient &
	ApiKeyClientMethods;

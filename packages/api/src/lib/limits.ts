import { auth } from "@uptimekit/auth";

export const MAX_MONITORS = 3;
export const MAX_STATUS_PAGES = 1;

// List of allowed integration types for non-self-hosted plan
// Currently allowing all common ones since we don't have a paywall yet,
// but the infrastructure is here to restrict them.
export const ALLOWED_INTEGRATIONS = ["discord", "webhook"];

export const isSelfHosted = () => {
	return process.env.NEXT_PUBLIC_SELFHOSTED === "true";
};

export const hasActiveSubscription = async (
	organizationId: string,
	headers: Headers,
) => {
	if (isSelfHosted()) {
		return true;
	}

	try {
		// @ts-expect-error - Dynamic property from plugin
		const { data } = await auth.api.customer.subscriptions.list({
			// @ts-expect-error - Headers type mismatch
			headers: headers,
			query: {
				limit: 10,
				active: true,
				referenceId: organizationId,
			},
		});

		// @ts-expect-error
		const hasActive = data?.items?.some(
			// @ts-expect-error
			(sub) => sub.status === "active" || sub.status === "trialing",
		);

		return hasActive ?? false;
	} catch (error) {
		console.error("Failed to check subscription:", error);
		return false;
	}
};

import { db } from "@uptimekit/db";
import { organization } from "@uptimekit/db/schema/auth";
import { eq } from "drizzle-orm";
import { createLogger } from "./logger";

const logger = createLogger("API");

export const MAX_MONITORS = 3;
export const MAX_STATUS_PAGES = 1;
export const MAX_ORGANIZATIONS = 1;

// List of allowed integration types for non-self-hosted plan
// Currently allowing all common ones since we don't have a paywall yet,
// but the infrastructure is here to restrict them.
export const ALLOWED_INTEGRATIONS = ["discord", "webhook"];

export const isSelfHosted = () => {
	return process.env.NEXT_PUBLIC_SELFHOSTED === "true";
};

export const hasActiveSubscription = async (organizationId: string) => {
	if (isSelfHosted()) {
		return true;
	}

	try {
		const org = await db.query.organization.findFirst({
			where: eq(organization.id, organizationId),
			columns: {
				plan: true,
			},
		});

		return org?.plan === "pro";
	} catch (error) {
		logger.error("Failed to check subscription:", error);
		return false;
	}
};

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCookieName, verifyAccessToken } from "./access-token";

interface StatusPageConfig {
	id: string;
	public: boolean;
	password: string | null;
	slug?: string;
}

export async function checkStatusPageAccess(
	statusPage: StatusPageConfig,
	currentPath: string,
): Promise<void> {
	// Public pages don't need access check
	if (statusPage.public) {
		return;
	}

	// Private page without password is accessible (owner may not have set password yet)
	if (!statusPage.password) {
		return;
	}

	// Check for valid access token in cookie
	const cookieStore = await cookies();
	const cookieName = getCookieName(statusPage.id);
	const token = cookieStore.get(cookieName)?.value;

	if (token && verifyAccessToken(token, statusPage.id)) {
		return;
	}

	// No valid token, redirect to password page
	const redirectUrl = encodeURIComponent(currentPath);
	redirect(`/password?pageId=${statusPage.id}&redirect=${redirectUrl}`);
}

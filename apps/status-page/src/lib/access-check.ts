import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
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
	if (await canAccessStatusPage(statusPage)) {
		return;
	}

	// No valid token, redirect to password page
	const redirectUrl = encodeURIComponent(currentPath);
	redirect(`/password?pageId=${statusPage.id}&redirect=${redirectUrl}`);
}

export function isStatusPagePubliclyAccessible(
	statusPage: StatusPageConfig,
): boolean {
	return statusPage.public || !statusPage.password;
}

export function hasStatusPageAccessToken(
	statusPage: StatusPageConfig,
	token: string | undefined,
): boolean {
	return Boolean(token && verifyAccessToken(token, statusPage.id));
}

export const canAccessStatusPage = cache(async function canAccessStatusPage(
	statusPage: StatusPageConfig,
): Promise<boolean> {
	if (isStatusPagePubliclyAccessible(statusPage)) {
		return true;
	}

	const cookieStore = await cookies();
	const cookieName = getCookieName(statusPage.id);
	const token = cookieStore.get(cookieName)?.value;

	return hasStatusPageAccessToken(statusPage, token);
});

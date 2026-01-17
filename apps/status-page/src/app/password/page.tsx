import { db, statusPage } from "@uptimekit/db";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PasswordForm } from "@/components/password-form";
import { ThemeSetter } from "@/components/theme-setter";
import { getCookieName, verifyAccessToken } from "@/lib/access-token";

function isSafeInternalPath(path: string): boolean {
	return (
		path.startsWith("/") &&
		!path.startsWith("//") &&
		!/^\/[a-z][a-z0-9+.-]*:/i.test(path)
	);
}

function safeDecodeRedirectPath(redirectPath: string | undefined): string {
	if (!redirectPath) return "/";

	try {
		const decoded = decodeURIComponent(redirectPath);
		return isSafeInternalPath(decoded) ? decoded : "/";
	} catch {
		return "/";
	}
}

interface PasswordPageProps {
	searchParams: Promise<{
		pageId?: string;
		redirect?: string;
	}>;
}

export const metadata: Metadata = {
	title: "Password Required",
};

export default async function PasswordPage({
	searchParams,
}: PasswordPageProps) {
	const params = await searchParams;
	const { pageId, redirect: redirectPath } = params;

	if (!pageId) {
		notFound();
	}

	const page = await db.query.statusPage.findFirst({
		where: eq(statusPage.id, pageId),
		columns: {
			id: true,
			name: true,
			public: true,
			password: true,
			design: true,
		},
	});

	if (!page) {
		notFound();
	}

	const safeRedirectPath = safeDecodeRedirectPath(redirectPath);

	// If page is public or has no password, redirect away
	if (page.public || !page.password) {
		redirect(safeRedirectPath as never);
	}

	// Check if already authenticated
	const cookieStore = await cookies();
	const token = cookieStore.get(getCookieName(pageId))?.value;
	if (token && verifyAccessToken(token, pageId)) {
		redirect(safeRedirectPath as never);
	}

	const design = (page.design as { theme?: string }) || {};
	const theme = design.theme === "dark" ? "dark" : "light";

	return (
		<>
			<ThemeSetter theme={theme} />
			<main className="min-h-screen bg-background">
				<PasswordForm statusPageId={pageId} redirectUrl={safeRedirectPath} />
			</main>
		</>
	);
}

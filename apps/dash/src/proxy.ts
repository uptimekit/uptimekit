import { auth } from "@uptimekit/auth";
import { type NextRequest, NextResponse } from "next/server";
import {
    getHostnameFromHostHeader,
    getStatusPageRewritePath,
    isPublicAssetPath,
    isStatusPageHost,
} from "@/lib/status-page-routing";

function isPublicDashboardPath(pathname: string): boolean {
    return (
        pathname === "/login" ||
        pathname === "/register" ||
        pathname === "/two-factor" ||
        pathname.startsWith("/api/") ||
        pathname.startsWith("/status") ||
        isPublicAssetPath(pathname)
    );
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const hostname =
        getHostnameFromHostHeader(request.headers.get("host")) ||
        request.nextUrl.hostname;

    if (isStatusPageHost(hostname) && !isPublicAssetPath(pathname)) {
        const statusPageUrl = request.nextUrl.clone();
        statusPageUrl.pathname = getStatusPageRewritePath(pathname);
        return NextResponse.rewrite(statusPageUrl);
    }

    if (isPublicDashboardPath(pathname)) {
        return NextResponse.next();
    }

    const session = await auth.api.getSession({
        headers: request.headers,
    });

    if (!session) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/:path*"],
};

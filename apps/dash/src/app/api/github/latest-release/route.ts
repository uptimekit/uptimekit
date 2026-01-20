import { NextResponse } from "next/server";

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
let cache: { version: string; fetchedAt: number } | null = null;

export async function GET() {
	const now = Date.now();

	// Return cached version if still valid
	if (cache && now - cache.fetchedAt < CACHE_TTL) {
		return NextResponse.json({ version: cache.version, cached: true });
	}

	try {
		const response = await fetch(
			"https://api.github.com/repos/uptimekit/worker/releases/latest",
			{
				headers: {
					Accept: "application/vnd.github+json",
					"User-Agent": "UptimeKit-Dashboard",
				},
			},
		);

		if (!response.ok) {
			throw new Error(`GitHub API error: ${response.status}`);
		}

		const data = await response.json();
		const version = data.tag_name.replace(/^v/, ""); // Remove 'v' prefix

		cache = { version, fetchedAt: now };

		return NextResponse.json({ version });
	} catch (error) {
		// Fallback to cached version if available
		if (cache) {
			return NextResponse.json({
				version: cache.version,
				cached: true,
				error: "Failed to fetch, using cache",
			});
		}

		return NextResponse.json(
			{ error: "Failed to fetch latest release" },
			{ status: 500 },
		);
	}
}

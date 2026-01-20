import {
	authenticateWorker,
	getMonitorsForWorker,
	isAuthError,
} from "@uptimekit/api/pkg/worker";
import { db } from "@uptimekit/db";
import { worker } from "@uptimekit/db/schema/workers";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Handle POST requests by authenticating a worker and returning monitors for the worker's location.
 *
 * @returns A Next.js response whose JSON body contains `monitors` for the authenticated worker. If authentication fails, the response JSON contains `error` and the HTTP status matches the authentication error.
 */
export async function POST(request: Request) {
	const authResult = await authenticateWorker(request);

	if (isAuthError(authResult)) {
		return NextResponse.json(
			{ error: authResult.error },
			{ status: authResult.status },
		);
	}

	// Parse request body for version and features
	let body: { version?: string; features?: string[] } = {};
	try {
		const text = await request.text();
		if (text) {
			body = JSON.parse(text);
		}
	} catch {
		// Ignore JSON parse errors - body is optional
	}

	// Update worker with version and features if provided
	if (body.version || body.features) {
		await db
			.update(worker)
			.set({
				...(body.version && { version: body.version }),
				...(body.features && { features: body.features }),
				updatedAt: new Date(),
			})
			.where(eq(worker.id, authResult.worker.id));
	}

	const monitors = await getMonitorsForWorker(authResult.worker.location);

	return NextResponse.json({ monitors });
}

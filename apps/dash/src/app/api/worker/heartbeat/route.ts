import {
	authenticateWorker,
	getMonitorsForWorker,
	isAuthError,
} from "@uptimekit/api/pkg/worker";
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

	const monitors = await getMonitorsForWorker(authResult.worker.location);

	return NextResponse.json({ monitors });
}
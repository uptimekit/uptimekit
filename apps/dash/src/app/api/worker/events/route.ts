import {
	authenticateWorker,
	isAuthError,
	type MonitorEvent,
	processMonitorEvents,
} from "@uptimekit/api/pkg/worker";
import { NextResponse } from "next/server";

/**
 * Handle POST requests: authenticate the worker, validate a JSON `events` array, and process monitor events.
 *
 * Validates that the request body is valid JSON and contains an `events` array. If authentication fails or the
 * request body is invalid, returns a JSON error response with the corresponding HTTP status.
 *
 * @param request - Incoming HTTP request whose JSON body must include an `events` array of monitor events
 * @returns A JSON HTTP response: on error returns an object with an `error` message and the appropriate status code; on success returns the result of processing the monitor events
 */
export async function POST(request: Request) {
	const authResult = await authenticateWorker(request);

	if (isAuthError(authResult)) {
		return NextResponse.json(
			{ error: authResult.error },
			{ status: authResult.status },
		);
	}

	let body: { events?: MonitorEvent[] };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	if (!body.events || !Array.isArray(body.events)) {
		return NextResponse.json(
			{ error: "Missing events array" },
			{ status: 400 },
		);
	}

	const result = await processMonitorEvents(body.events, authResult.worker.id);

	return NextResponse.json(result);
}

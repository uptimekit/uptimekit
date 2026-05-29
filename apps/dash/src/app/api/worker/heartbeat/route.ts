import {
	authenticateWorker,
	getMonitorsForWorker,
	isAuthError,
} from "@uptimekit/api/pkg/worker";
import { NextResponse } from "next/server";
import { useLogger, withEvlog } from "@/lib/evlog";

/**
 * Handle POST requests by authenticating a worker and returning monitors for the worker's location.
 *
 * @returns A Next.js response whose JSON body contains `monitors` for the authenticated worker. If authentication fails, the response JSON contains `error` and the HTTP status matches the authentication error.
 */
export const POST = withEvlog(async function POST(request: Request) {
	const logger = useLogger();
	const authResult = await authenticateWorker(request);

	if (isAuthError(authResult)) {
		logger.set({
			event: "auth_failed",
			error: authResult.error,
			status: authResult.status,
		});
		return NextResponse.json(
			{ error: authResult.error },
			{ status: authResult.status },
		);
	}

	logger.set({
		event: "auth_success",
		workerId: authResult.worker.id,
	});

	const monitors = await getMonitorsForWorker(authResult.worker.id);

	logger.set({
		event: "returning_monitors",
		monitorCount: monitors.length,
	});

	return NextResponse.json({ monitors });
});

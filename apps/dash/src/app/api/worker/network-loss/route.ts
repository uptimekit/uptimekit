import {
	authenticateWorker,
	isAuthError,
	processNetworkLossEvent,
} from "@uptimekit/api/pkg/worker";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	const authResult = await authenticateWorker(request);

	if (isAuthError(authResult)) {
		return NextResponse.json(
			{ error: authResult.error },
			{ status: authResult.status },
		);
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	if (!body.monitorId || !body.alertType || !body.timestamp) {
		return NextResponse.json(
			{ error: "Missing required fields" },
			{ status: 400 },
		);
	}

	if (body.alertType !== "triggered" && body.alertType !== "resolved") {
		return NextResponse.json(
			{ error: "alertType must be 'triggered' or 'resolved'" },
			{ status: 400 },
		);
	}

	const result = await processNetworkLossEvent(
		body,
		authResult.worker.location,
	);

	return NextResponse.json(result);
}

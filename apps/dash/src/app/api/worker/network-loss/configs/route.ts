import {
	authenticateWorker,
	getNetworkLossMonitorsForWorker,
	isAuthError,
} from "@uptimekit/api/pkg/worker";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	const authResult = await authenticateWorker(request);

	if (isAuthError(authResult)) {
		return NextResponse.json(
			{ error: authResult.error },
			{ status: authResult.status },
		);
	}

	const monitors = await getNetworkLossMonitorsForWorker(
		authResult.worker.location,
	);

	return NextResponse.json({ monitors });
}

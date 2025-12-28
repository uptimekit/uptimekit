import { NextResponse } from "next/server";
import {
    authenticateWorker,
    isAuthError,
    processMonitorEvents,
    type MonitorEvent,
} from "@uptimekit/api/pkg/worker";

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

    const result = await processMonitorEvents(
        body.events,
        authResult.worker.location,
    );

    return NextResponse.json(result);
}

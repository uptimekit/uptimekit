import {
    authenticateWorker,
    isAuthError,
    type MonitorEvent,
    processMonitorEvents,
} from "@uptimekit/api/pkg/worker";
import { NextResponse } from "next/server";
import { withEvlog } from "@/lib/evlog";

const MAX_EVENT_REQUEST_BYTES = 2 * 1024 * 1024;
const MAX_EVENTS_PER_REQUEST = 1000;
const MAX_CONCURRENT_EVENT_REQUESTS = 8;
let activeEventRequests = 0;

class EventRequestTooLargeError extends Error {}

async function readJsonBody(request: Request): Promise<unknown> {
    const contentLength = request.headers.get("content-length");
    const declaredLength = contentLength ? Number(contentLength) : undefined;

    if (
        declaredLength !== undefined &&
        Number.isFinite(declaredLength) &&
        declaredLength > MAX_EVENT_REQUEST_BYTES
    ) {
        throw new EventRequestTooLargeError();
    }

    if (!request.body) {
        return undefined;
    }

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }

        if (!value) {
            continue;
        }

        totalBytes += value.byteLength;
        if (totalBytes > MAX_EVENT_REQUEST_BYTES) {
            await reader.cancel();
            throw new EventRequestTooLargeError();
        }

        chunks.push(value);
    }

    const bodyBytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
        bodyBytes.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return JSON.parse(new TextDecoder().decode(bodyBytes));
}

/**
 * Handle POST requests: authenticate the worker, validate a JSON `events` array, and process monitor events.
 *
 * Validates that the request body is valid JSON and contains an `events` array. If authentication fails or the
 * request body is invalid, returns a JSON error response with the corresponding HTTP status.
 *
 * @param request - Incoming HTTP request whose JSON body must include an `events` array of monitor events
 * @returns A JSON HTTP response: on error returns an object with an `error` message and the appropriate status code; on success returns the result of processing the monitor events
 */
async function handlePost(request: Request) {
    const authResult = await authenticateWorker(request);

    if (isAuthError(authResult)) {
        return NextResponse.json(
            { error: authResult.error },
            { status: authResult.status },
        );
    }

    if (activeEventRequests >= MAX_CONCURRENT_EVENT_REQUESTS) {
        return NextResponse.json(
            { error: "Worker event processing is temporarily busy" },
            {
                status: 503,
                headers: { "Retry-After": "1" },
            },
        );
    }

    activeEventRequests++;

    try {
        let parsedBody: unknown;
        try {
            parsedBody = await readJsonBody(request);
        } catch (error) {
            if (error instanceof EventRequestTooLargeError) {
                return NextResponse.json(
                    {
                        error: `Request body exceeds ${MAX_EVENT_REQUEST_BYTES} bytes`,
                    },
                    { status: 413 },
                );
            }

            return NextResponse.json(
                { error: "Invalid JSON body" },
                { status: 400 },
            );
        }

        if (
            !parsedBody ||
            typeof parsedBody !== "object" ||
            Array.isArray(parsedBody)
        ) {
            return NextResponse.json(
                { error: "Missing events array" },
                { status: 400 },
            );
        }

        const body = parsedBody as { events?: MonitorEvent[] };
        if (!body.events || !Array.isArray(body.events)) {
            return NextResponse.json(
                { error: "Missing events array" },
                { status: 400 },
            );
        }

        if (body.events.length > MAX_EVENTS_PER_REQUEST) {
            return NextResponse.json(
                {
                    error: `A maximum of ${MAX_EVENTS_PER_REQUEST} events may be submitted at once`,
                },
                { status: 413 },
            );
        }

        const result = await processMonitorEvents(
            body.events,
            authResult.worker.id,
        );

        return NextResponse.json(result);
    } finally {
        activeEventRequests--;
    }
}

export const POST = withEvlog(handlePost);

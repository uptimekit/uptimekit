import { z } from "zod";
import type { MonitorEvent } from "./service";

const MAX_ERROR_LENGTH = 2_000;
// A future timestamp would outrank every real event in "latest status" queries forever.
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const optionalTiming = z.number().finite().nonnegative().optional();

const monitorEventSchema = z.object({
    id: z.string().min(1).max(128).optional(),
    monitorId: z.string().min(1).max(255),
    status: z.enum(["up", "down", "degraded", "maintenance", "pending"]),
    latency: z.number().finite().nonnegative(),
    timestamp: z
        .union([z.string(), z.number()])
        .refine((value) => !Number.isNaN(new Date(value).getTime()), {
            message: "Invalid timestamp",
        })
        .refine(
            (value) =>
                new Date(value).getTime() <= Date.now() + MAX_CLOCK_SKEW_MS,
            { message: "Timestamp is in the future" },
        ),
    statusCode: z.number().int().min(0).max(999).optional(),
    error: z
        .string()
        .optional()
        .transform((value) => value?.slice(0, MAX_ERROR_LENGTH)),
    location: z.string().optional(),
    timings: z
        .object({
            dnsLookup: optionalTiming,
            tcpConnect: optionalTiming,
            tlsHandshake: optionalTiming,
            ttfb: optionalTiming,
            transfer: optionalTiming,
            total: optionalTiming,
        })
        .optional(),
});

/**
 * Validate raw worker events one by one.
 *
 * Invalid events are dropped instead of failing the request: workers retry a
 * rejected batch indefinitely, so one malformed event would otherwise block
 * every later result from that worker. Events are always attributed to the
 * authenticated worker, so a worker cannot report on behalf of another.
 */
export function parseWorkerEvents(rawEvents: unknown[], workerId: string) {
    const events: MonitorEvent[] = [];
    let rejected = 0;

    for (const rawEvent of rawEvents) {
        const parsed = monitorEventSchema.safeParse(rawEvent);
        if (!parsed.success) {
            rejected++;
            continue;
        }

        events.push({ ...parsed.data, location: workerId });
    }

    return { events, rejected };
}

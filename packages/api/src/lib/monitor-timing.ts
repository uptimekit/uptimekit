import { z } from "zod";

const DEFAULT_RETRY_INTERVAL = 20;

export const monitorTimingSchema = {
    interval: z.coerce.number().int().min(10).default(60),
    timeout: z.coerce.number().int().min(1).max(300).default(48),
    retries: z.coerce.number().int().min(0).max(10).default(2),
    // No static default. Resolved to min(20, interval) so low intervals stay valid.
    retryInterval: z.coerce.number().int().min(1).max(300).optional(),
};

export function withMonitorTimingRelations<
    Shape extends z.ZodRawShape & {
        interval: z.ZodType<number>;
        retryInterval: z.ZodType<number | undefined>;
    },
>(schema: z.ZodObject<Shape>) {
    return schema
        .transform((data) => {
            const timing = data as { interval: number; retryInterval?: number };
            return {
                ...data,
                retryInterval:
                    timing.retryInterval ??
                    Math.min(DEFAULT_RETRY_INTERVAL, timing.interval),
            };
        })
        .refine(
            (data) => {
                const timing = data as {
                    interval: number;
                    retryInterval: number;
                };
                return timing.retryInterval <= timing.interval;
            },
            {
                message:
                    "Retry interval must be less than or equal to the heartbeat interval",
                path: ["retryInterval"],
            },
        );
}

export const monitorTimingObjectSchema = withMonitorTimingRelations(
    z.object(monitorTimingSchema),
);

export const monitorTimingDefaults = monitorTimingObjectSchema.parse({});

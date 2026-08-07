export interface ReadinessCheckResult {
    ok: boolean;
    latencyMs: number;
}

export interface ReadinessResult {
    ok: boolean;
    checks: Record<string, ReadinessCheckResult>;
}

function withTimeout(check: Promise<unknown>, timeoutMs: number) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
            () =>
                reject(
                    new Error(`Readiness check timed out after ${timeoutMs}ms`),
                ),
            timeoutMs,
        );
    });

    return Promise.race([check, timeout]).finally(() => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    });
}

export async function runReadinessChecks(
    checks: Record<string, () => Promise<unknown>>,
    timeoutMs = 2_000,
): Promise<ReadinessResult> {
    const entries = await Promise.all(
        Object.entries(checks).map(async ([name, check]) => {
            const startedAt = performance.now();

            try {
                await withTimeout(Promise.resolve().then(check), timeoutMs);
                return [
                    name,
                    {
                        ok: true,
                        latencyMs: Math.round(performance.now() - startedAt),
                    },
                ] as const;
            } catch {
                return [
                    name,
                    {
                        ok: false,
                        latencyMs: Math.round(performance.now() - startedAt),
                    },
                ] as const;
            }
        }),
    );
    const results: Record<string, ReadinessCheckResult> =
        Object.fromEntries(entries);

    return {
        ok: Object.values(results).every((result) => result.ok),
        checks: results,
    };
}

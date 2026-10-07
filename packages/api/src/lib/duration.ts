export function formatDuration(ms: number) {
    const totalMinutes = Math.max(0, Math.round(ms / 60_000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

    return parts.join(" ");
}

interface ResolvedIncidentTimeline {
    startedAt?: unknown;
    resolvedAt?: unknown;
}

export function getResolvedIncidentDuration(
    event: string,
    payload: ResolvedIncidentTimeline,
) {
    if (event !== "incident.resolved") return null;
    if (typeof payload.startedAt !== "string") return null;
    if (typeof payload.resolvedAt !== "string") return null;

    const startedAtMs = Date.parse(payload.startedAt);
    const resolvedAtMs = Date.parse(payload.resolvedAt);
    if (Number.isNaN(startedAtMs) || Number.isNaN(resolvedAtMs)) return null;

    return formatDuration(resolvedAtMs - startedAtMs);
}

export const WORKER_HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000;

export type WorkerAvailabilityStatus = "online" | "offline" | "unknown";

type HeartbeatInput = Date | string | number | null | undefined;

function getHeartbeatTime(lastHeartbeat: HeartbeatInput) {
    if (
        lastHeartbeat === null ||
        lastHeartbeat === undefined ||
        lastHeartbeat === ""
    ) {
        return null;
    }

    const heartbeatTime = new Date(lastHeartbeat).getTime();
    return Number.isNaN(heartbeatTime) ? null : heartbeatTime;
}

export function getWorkerHeartbeatThreshold(now: Date = new Date()) {
    return new Date(now.getTime() - WORKER_HEARTBEAT_TIMEOUT_MS);
}

export function isWorkerHeartbeatFresh(
    lastHeartbeat: HeartbeatInput,
    now: Date = new Date(),
) {
    const heartbeatTime = getHeartbeatTime(lastHeartbeat);

    if (heartbeatTime === null) {
        return false;
    }

    return now.getTime() - heartbeatTime <= WORKER_HEARTBEAT_TIMEOUT_MS;
}

export function getWorkerAvailabilityStatus(input: {
    active: boolean;
    lastHeartbeat: HeartbeatInput;
    now?: Date;
}): WorkerAvailabilityStatus {
    const heartbeatTime = getHeartbeatTime(input.lastHeartbeat);

    if (heartbeatTime === null) {
        return "unknown";
    }

    const now = input.now ?? new Date();
    if (
        input.active &&
        now.getTime() - heartbeatTime <= WORKER_HEARTBEAT_TIMEOUT_MS
    ) {
        return "online";
    }

    return "offline";
}

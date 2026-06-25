import { ORPCError } from "@orpc/server";
import { io, type Socket } from "socket.io-client";
import type { KumaConnection, KumaMonitorList } from "./types";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "ws:", "wss:"]);
const CONNECT_TIMEOUT_MS = 15_000;
const FETCH_TIMEOUT_MS = 15_000;

function toHttpOrigin(rawUrl: string): string {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new ORPCError("BAD_REQUEST", {
            message: "Enter a valid Uptime Kuma URL.",
        });
    }

    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
        throw new ORPCError("BAD_REQUEST", {
            message: "The URL must use http, https, ws, or wss.",
        });
    }

    const httpProtocol =
        parsed.protocol === "https:" || parsed.protocol === "wss:"
            ? "https:"
            : "http:";

    return `${httpProtocol}//${parsed.host}`;
}

interface LoginAck {
    ok: boolean;
    msg?: string;
    tokenRequired?: boolean;
}

export async function fetchKumaMonitorList(
    connection: KumaConnection,
): Promise<KumaMonitorList> {
    const origin = toHttpOrigin(connection.url);

    return new Promise<KumaMonitorList>((resolve, reject) => {
        const socket: Socket = io(origin, {
            reconnection: false,
            timeout: CONNECT_TIMEOUT_MS,
            forceNew: true,
        });

        let settled = false;
        const finish = (fn: () => void) => {
            if (settled) return;
            settled = true;
            clearTimeout(fetchTimer);
            socket.disconnect();
            fn();
        };

        const fetchTimer = setTimeout(() => {
            finish(() =>
                reject(
                    new ORPCError("BAD_REQUEST", {
                        message:
                            "Timed out fetching monitors from Uptime Kuma.",
                    }),
                ),
            );
        }, CONNECT_TIMEOUT_MS + FETCH_TIMEOUT_MS);

        socket.on("connect_error", () => {
            finish(() =>
                reject(
                    new ORPCError("BAD_REQUEST", {
                        message:
                            "Could not connect to the Uptime Kuma instance. Check the URL is correct and reachable from this server (including any proxy in front of it).",
                    }),
                ),
            );
        });

        // Kuma pushes the monitor list after a successful login.
        socket.on("monitorList", (list: KumaMonitorList) => {
            finish(() => resolve(list ?? {}));
        });

        socket.on("connect", () => {
            socket.emit(
                "login",
                {
                    username: connection.username,
                    password: connection.password,
                    token: connection.token ?? "",
                },
                (ack: LoginAck) => {
                    if (!ack?.ok) {
                        finish(() =>
                            reject(
                                new ORPCError("BAD_REQUEST", {
                                    message: ack?.tokenRequired
                                        ? "This Uptime Kuma instance requires a 2FA token."
                                        : ack?.msg ||
                                          "Invalid username or password.",
                                }),
                            ),
                        );
                    }
                },
            );
        });
    });
}

import os from "node:os";
import ping from "ping";
import type { MonitorConfig } from "../api-client.js";
import { BaseMonitor, type MonitorResult } from "./registry.js";

export class IcmpMonitor extends BaseMonitor {
	async check(monitor: MonitorConfig): Promise<MonitorResult> {
		if (!monitor.url) {
			return {
				monitorId: monitor.id,
				status: "down",
				latency: 0,
				error: "Missing URL/Host for ICMP monitor",
				timestamp: new Date().toISOString(),
			};
		}

		let hostname = monitor.url;

		// Strip protocol
		if (hostname.includes("://")) {
			const parts = hostname.split("://");
			if (parts[1]) {
				hostname = parts[1];
			}
		}

		// Remove port if present (simple check)
		if (hostname.includes(":") && !hostname.includes("]")) {
			const parts = hostname.split(":");
			if (parts[0]) hostname = parts[0];
		}

		const isWindows = os.platform() === "win32";
		const timeout = monitor.timeout || 2;

		// Windows ping uses -w in milliseconds, others (Linux/Mac) usually in seconds
		const timeoutVal = isWindows ? timeout * 1000 : timeout;

		// Windows uses -n for count, others use -c
		const countFlag = isWindows ? "-n" : "-c";

		try {
			const res = await ping.promise.probe(hostname, {
				timeout: timeoutVal,
				extra: [countFlag, "3"], // Send 3 packets
			});

			if (!res.alive) {
				return {
					monitorId: monitor.id,
					status: "down",
					latency: 0,
					error: "Request Timed Out or Host Unreachable",
					timestamp: new Date().toISOString(),
				};
			}

			// Parse latency. 'time' is usually in ms, but can be 'unknown' or number.
			let latency = 0;
			if (typeof res.time === "number") {
				latency = res.time;
			} else if (typeof res.time === "string") {
				latency = Number.parseFloat(res.time);
			}

			return {
				monitorId: monitor.id,
				status: "up",
				latency: Number.isNaN(latency) ? 0 : latency,
				timestamp: new Date().toISOString(),
			};
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			return {
				monitorId: monitor.id,
				status: "down",
				latency: 0,
				error: `Ping Error: ${errorMessage}`,
				timestamp: new Date().toISOString(),
			};
		}
	}
}

import { createRequire } from "node:module";
import type { MonitorConfig } from "../api-client.js";
import { BaseMonitor, type MonitorResult } from "./registry.js";

const require = createRequire(import.meta.url);
const ping = require("net-ping");

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

		const timeout = (monitor.timeout || 2) * 1000;

		return new Promise((resolve) => {
			// biome-ignore lint/suspicious/noExplicitAny: net-ping lacks types
			let session: any;
			try {
				session = ping.createSession({
					packetSize: 16,
					timeout: timeout,
					retries: 0,
				});
			} catch (err: any) {
				// biome-ignore lint/suspicious/noExplicitAny: error type unknown
				return resolve({
					monitorId: monitor.id,
					status: "down",
					latency: 0,
					error: `Session Error: ${err.message || err} (Requires Root/Admin)`,
					timestamp: new Date().toISOString(),
				});
			}

			session.pingHost(
				hostname,
				// biome-ignore lint/suspicious/noExplicitAny: net-ping lacks types
				(error: any, _target: string, sent: Date, rcvd: Date) => {
					session.close();

					if (error) {
						let errorMsg = error.message || error.toString();
						if (error instanceof ping.RequestTimedOutError) {
							errorMsg = "Request Timed Out";
						}
						resolve({
							monitorId: monitor.id,
							status: "down",
							latency: 0,
							error: errorMsg,
							timestamp: new Date().toISOString(),
						});
					} else {
						const latency = rcvd.getTime() - sent.getTime();
						resolve({
							monitorId: monitor.id,
							status: "up",
							latency: latency,
							timestamp: new Date().toISOString(),
						});
					}
				},
			);
		});
	}
}

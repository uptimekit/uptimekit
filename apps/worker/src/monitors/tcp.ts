import { createConnection } from "node:net";
import { performance } from "node:perf_hooks";
import type { MonitorConfig } from "../api-client.js";
import { BaseMonitor, type MonitorResult } from "./registry.js";

export class TcpMonitor extends BaseMonitor {
	async check(monitor: MonitorConfig): Promise<MonitorResult> {
		const startTime = performance.now();

		if (!monitor.url) {
			return {
				monitorId: monitor.id,
				status: "down",
				latency: 0,
				error: "Missing URL/Host for TCP monitor",
				timestamp: new Date().toISOString(),
			};
		}

		// Parse host and port
		let hostname = monitor.url;
		let port = 80;

		// Strip tcp:// protocol if present
		if (hostname.startsWith("tcp://")) {
			hostname = hostname.slice(6);
		}

		// Check for port in hostname
		// Note: IPv6 uses [host]:port, so we need to be careful.
		// For simplicity, assuming simple hostname:port or IPv4:port
		if (hostname.includes(":") && !hostname.includes("]")) {
			const parts = hostname.split(":");
			if (parts[0]) hostname = parts[0];
			const parsedPort = Number(parts[1]);
			if (!Number.isNaN(parsedPort)) {
				port = parsedPort;
			}
		}

		const timeout = (monitor.timeout || 3) * 1000;

		return new Promise((resolve) => {
			const socket = createConnection(port, hostname);
			socket.setTimeout(timeout);

			const onConnect = () => {
				const endTime = performance.now();
				socket.end();
				socket.removeAllListeners();
				resolve({
					monitorId: monitor.id,
					status: "up",
					latency: Math.round(endTime - startTime),
					timestamp: new Date().toISOString(),
				});
			};

			const onError = (err: Error) => {
				const endTime = performance.now();
				socket.destroy();
				socket.removeAllListeners();
				resolve({
					monitorId: monitor.id,
					status: "down",
					latency: Math.round(endTime - startTime),
					error: err.message,
					timestamp: new Date().toISOString(),
				});
			};

			const onTimeout = () => {
				const endTime = performance.now();
				socket.destroy();
				socket.removeAllListeners();
				resolve({
					monitorId: monitor.id,
					status: "down",
					latency: Math.round(endTime - startTime),
					error: "Connection timed out",
					timestamp: new Date().toISOString(),
				});
			};

			socket.on("connect", onConnect);
			socket.on("error", onError);
			socket.on("timeout", onTimeout);
		});
	}
}

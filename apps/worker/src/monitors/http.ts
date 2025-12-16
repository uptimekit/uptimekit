import ky from "ky";
import type { MonitorConfig } from "../api-client.js";
import { BaseMonitor, type MonitorResult } from "./registry.js";

export class HttpMonitor extends BaseMonitor {
	async check(monitor: MonitorConfig): Promise<MonitorResult> {
		const startTime = performance.now();
		try {
			if (!monitor.url) {
				throw new Error("Missing URL for HTTP monitor");
			}

			try {
				new URL(monitor.url);
			} catch {
				throw new Error(`Invalid URL: ${monitor.url}`);
			}

			const response = await ky(monitor.url, {
				method: monitor.method || "get",
				headers: monitor.headers,
				body: monitor.body ? JSON.stringify(monitor.body) : undefined,
				timeout: (monitor.timeout || 30) * 1000,
				retry: 0,
				throwHttpErrors: false,
			});

			const endTime = performance.now();
			const latency = Math.round(endTime - startTime);

			const isUp = response.status >= 200 && response.status < 300;

			return {
				monitorId: monitor.id,
				status: isUp ? "up" : "down",
				latency,
				statusCode: response.status,
				error: isUp
					? undefined
					: `HTTP ${response.status} ${response.statusText}`,
				timestamp: new Date().toISOString(),
			};
		} catch (error: any) {
			const endTime = performance.now();
			return {
				monitorId: monitor.id,
				status: "down",
				latency: Math.round(endTime - startTime),
				error: error.message || "Unknown error",
				timestamp: new Date().toISOString(),
			};
		}
	}
}

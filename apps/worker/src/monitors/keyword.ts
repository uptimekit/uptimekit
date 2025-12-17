import ky from "ky";
import type { MonitorConfig } from "../api-client.js";
import { BaseMonitor, type MonitorResult } from "./registry.js";

export class KeywordMonitor extends BaseMonitor {
	async check(monitor: MonitorConfig): Promise<MonitorResult> {
		const startTime = performance.now();
		try {
			if (!monitor.url) {
				throw new Error("Missing URL for Keyword monitor");
			}
			if (!monitor.keyword) {
				throw new Error("Missing keyword for Keyword monitor");
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

			const responseBody = await response.text();
			const endTime = performance.now();
			const latency = Math.round(endTime - startTime);

			let isUp = false;
			let error: string | undefined;

			// Check Status Code
			let statusOk = false;
			if (monitor.acceptedStatusCodes) {
				const ranges = monitor.acceptedStatusCodes
					.split(",")
					.map((s) => s.trim());
				for (const range of ranges) {
					if (range.includes("-")) {
						const parts = range.split("-").map((p) => Number(p.trim()));
						if (parts.length === 2) {
							const min = parts[0];
							const max = parts[1];
							if (
								min !== undefined &&
								max !== undefined &&
								!Number.isNaN(min) &&
								!Number.isNaN(max) &&
								response.status >= min &&
								response.status <= max
							) {
								statusOk = true;
								break;
							}
						}
					} else {
						const code = Number(range);
						if (!Number.isNaN(code) && response.status === code) {
							statusOk = true;
							break;
						}
					}
				}
			} else {
				statusOk = response.status >= 200 && response.status < 300;
			}

			if (!statusOk) {
				isUp = false;
				error = `HTTP ${response.status} ${response.statusText}`;
			} else {
				// Check Keyword
				if (responseBody.includes(monitor.keyword)) {
					isUp = true;
				} else {
					isUp = false;
					error = `Keyword "${monitor.keyword}" not found`;
				}
			}

			return {
				monitorId: monitor.id,
				status: isUp ? "up" : "down",
				latency,
				statusCode: response.status,
				error: error,
				timestamp: new Date().toISOString(),
			};
		} catch (error: unknown) {
			const endTime = performance.now();
			return {
				monitorId: monitor.id,
				status: "down",
				latency: Math.round(endTime - startTime),
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString(),
			};
		}
	}
}

import jsonata from "jsonata";
import ky from "ky";
import type { MonitorConfig } from "../api-client.js";
import { BaseMonitor, type MonitorResult } from "./registry.js";

export class HttpJsonMonitor extends BaseMonitor {
	async check(monitor: MonitorConfig): Promise<MonitorResult> {
		const startTime = performance.now();
		try {
			if (!monitor.url) {
				throw new Error("Missing URL for HTTP JSON monitor");
			}
			if (!monitor.jsonPath) {
				throw new Error("Missing JSONata expression for HTTP JSON monitor");
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

			let isUp = false;
			let error: string | undefined;

			// Check Status Code first
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
				// Parse JSON and Evaluate
				try {
					const jsonBody = await response.json();
					const expression = jsonata(monitor.jsonPath);
					const result = await expression.evaluate(jsonBody);

					// We consider it UP if the result is truthy (not null, undefined, false, 0, "")
					// But specifically for validation expressions returning boolean, true is UP.
					// If the user selects a value, existence is UP.
					if (result) {
						isUp = true;
					} else {
						isUp = false;
						error = `JSONata validation failed. Result: ${JSON.stringify(result)}`;
					}
				} catch (e: unknown) {
					isUp = false;
					error = `JSON processing failed: ${e instanceof Error ? e.message : String(e)}`;
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

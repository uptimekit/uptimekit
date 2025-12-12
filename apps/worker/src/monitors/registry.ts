import type { MonitorConfig } from "../api-client.js";

export interface MonitorResult {
	monitorId: string;
	status: "up" | "down" | "degraded";
	latency: number;
	statusCode?: number;
	error?: string;
	timestamp: string;
}

export abstract class BaseMonitor {
	abstract check(monitor: MonitorConfig): Promise<MonitorResult>;
}

export class MonitorRegistry {
	private checkers = new Map<string, BaseMonitor>();

	register(type: string, checker: BaseMonitor) {
		this.checkers.set(type, checker);
	}

	get(type: string): BaseMonitor | undefined {
		return this.checkers.get(type);
	}
}

export const registry = new MonitorRegistry();

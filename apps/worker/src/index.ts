import dotenv from "dotenv";
import cron from "node-cron";
import { ApiClient, type MonitorConfig } from "./api-client.js";
import { HttpMonitor } from "./monitors/http.js";
import { HttpJsonMonitor } from "./monitors/http-json.js";
import { KeywordMonitor } from "./monitors/keyword.js";
import { registry } from "./monitors/registry.js";

dotenv.config();

registry.register("http", new HttpMonitor());
registry.register("keyword", new KeywordMonitor());
registry.register("http-json", new HttpJsonMonitor());

async function main() {
	const apiKey = process.env.WORKER_API_KEY;
	const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:3000";

	if (!apiKey) {
		console.error("Missing WORKER_API_KEY environment variable");
		process.exit(1);
	}

	const api = new ApiClient(dashboardUrl, apiKey);

	console.log("Worker started. Scheduling checks every minute.");

	await tick(api);

	cron.schedule("* * * * *", () => {
		tick(api);
	});
}

async function tick(api: ApiClient) {
	console.log(`[${new Date().toISOString()}] Starting tick...`);

	const monitors = await api.heartbeat();
	console.log(`Received ${monitors.length} monitors.`);

	if (monitors.length === 0) return;

	const results = await Promise.all(
		monitors.map(async (monitor: MonitorConfig) => {
			const checker = registry.get(monitor.type);
			if (!checker) {
				console.warn(`No checker found for type: ${monitor.type}`);
				return null;
			}

			try {
				return await checker.check(monitor);
			} catch (e) {
				console.error(`Check failed for ${monitor.id}`, e);
				return null;
			}
		}),
	);

	const validResults = results.filter((r) => r !== null);

	if (validResults.length > 0) {
		await api.pushEvents(validResults);
		console.log(`Pushed ${validResults.length} events.`);
	}

	await api.processMaintenance();
}

main().catch(console.error);

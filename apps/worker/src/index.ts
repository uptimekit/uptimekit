import cron from "node-cron";
import dotenv from "dotenv";
import { ApiClient, type MonitorConfig } from "./api-client.js";
import { registry } from "./monitors/registry.js";
import { HttpMonitor } from "./monitors/http.js";

dotenv.config();

// Register monitors
registry.register("http", new HttpMonitor());
// registry.register("tcp", new TcpMonitor()); // To be implemented

async function main() {
	const apiKey = process.env.WORKER_API_KEY;
	const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:3000";

	if (!apiKey) {
		console.error("Missing WORKER_API_KEY environment variable");
		process.exit(1);
	}

	const api = new ApiClient(dashboardUrl, apiKey);

	console.log("Worker started. Scheduling checks every minute.");

	// Run immediately on startup
	await tick(api);

	// Schedule cron
	cron.schedule("* * * * *", () => {
		tick(api);
	});
}

async function tick(api: ApiClient) {
	console.log(`[${new Date().toISOString()}] Starting tick...`);

	// 1. Heartbeat to get config
	const monitors = await api.heartbeat();
	console.log(`Received ${monitors.length} monitors.`);

	if (monitors.length === 0) return;

	// 2. Run checks
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

	// Filter nulls
	const validResults = results.filter((r) => r !== null);

	// 3. Push events
	if (validResults.length > 0) {
		await api.pushEvents(validResults);
		console.log(`Pushed ${validResults.length} events.`);
	}

	// 4. Process maintenance updates
	await api.processMaintenance();
}

main().catch(console.error);

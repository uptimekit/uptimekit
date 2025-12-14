import ky from "ky";
import { z } from "zod";

const MonitorSchema = z.object({
	id: z.string(),
	type: z.string(),
	url: z.string().optional(),
	interval: z.number(),
	timeout: z.number(),
	method: z.string().optional(),
	headers: z.record(z.string()).optional(),
	body: z.any().optional(),
});

export type MonitorConfig = z.infer<typeof MonitorSchema>;

export class ApiClient {
	private client: typeof ky;

	constructor(baseUrl: string, apiKey: string) {
		this.client = ky.create({
			prefixUrl: baseUrl,
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
			retry: {
				limit: 3,
				methods: ["post", "get"],
			},
		});
	}

	async heartbeat() {
		try {
			const response = await this.client.post(
				"api/rpc/workerIngest/heartbeat",
				{
					json: {}, // oRPC might expect a body even if empty
				},
			);
			const data = await response.json<any>();
			return (
				data.json?.monitors || data.result?.monitors || data.monitors || []
			);
		} catch (error) {
			console.error("Heartbeat failed", error);
			return [];
		}
	}

	async pushEvents(events: any[]) {
		if (events.length === 0) return;

		console.log("Pushing events payload:", JSON.stringify({ events }, null, 2));

		try {
			await this.client.post("api/rpc/workerIngest/pushEvents", {
				json: { json: { events } },
			});
		} catch (error) {
			console.error("Push events failed", JSON.stringify(error, null, 2));
			if (error instanceof Error && (error as any).data) {
				// Check for Zod issues structure
				console.log(
					"Validation issues:",
					JSON.stringify((error as any).data, null, 2),
				);
			}
		}
	}

	async processMaintenance() {
		try {
			await this.client.post("api/rpc/workerIngest/processMaintenance", {
				json: {},
			});
		} catch (error) {
			console.error("Process maintenance failed", error);
		}
	}
}

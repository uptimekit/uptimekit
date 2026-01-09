import { db } from "@uptimekit/db";
import type { z } from "zod";
import type { IntegrationDefinition } from "../registry";
import {
	type DiscordConfigSchema,
	discordIntegrationMeta,
} from "./discord-meta";

export const discordIntegration: IntegrationDefinition<
	z.infer<typeof DiscordConfigSchema>
> = {
	...discordIntegrationMeta,
	handler: async (config, event, payload: any) => {
		// console.log(`[Discord] Sending ${event} to ${config.webhookUrl}`);

		try {
			// Handle test event separately (no DB lookup needed)
			if (event === "integration.test") {
				const timestamp = Math.floor(Date.now() / 1000);
				const dateString = `<t:${timestamp}:D>`;
				const timeString = `<t:${timestamp}:T>`;

				const embed = {
					color: 3447003, // Blue
					description: "> `🧪` Integration test",
					fields: [
						{
							name: "`💻` Status",
							value: "Your Discord integration is working correctly!",
							inline: true,
						},
						{
							name: "`📅` Date",
							value: dateString,
							inline: true,
						},
						{
							name: "`⏰` Time",
							value: timeString,
							inline: true,
						},
						{
							name: "`💬` Message",
							value: `\`\`\`\n${payload.description}\n\`\`\``,
						},
					],
				};

				await fetch(config.webhookUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						embeds: [embed],
					}),
				});
				return;
			}

			// Fetch full incident data to get monitors
			const incidentData = await db.query.incident.findFirst({
				where: (t, { eq }) => eq(t.id, payload.incidentId),
				with: {
					monitors: {
						with: {
							monitor: true,
						},
					},
				},
			});

			if (!incidentData) {
				// console.warn(
				// 	`[Discord] Could not find incident ${payload.incidentId} for event ${event}`,
				// );
				return;
			}

			const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

			// Format Monitors Field
			const monitorLinks =
				incidentData.monitors
					.map((m) => {
						const url = `${baseUrl}/monitors/${m.monitor.id}`;
						return `[\`${m.monitor.name}\`](${url})`;
					})
					.join(", ") || "No monitors";

			// Format Date/Time Fields
			const timestamp = Math.floor(Date.now() / 1000);
			const dateString = `<t:${timestamp}:D>`;
			const timeString = `<t:${timestamp}:T>`;
			const incidentUrl = `${baseUrl}/incidents/${payload.incidentId}`;

			// Determine Embed Content based on Event
			let statusHeader = "";
			let color = 0;
			let reasonContent = "";
			let reasonLabel = "`❓` Reason";

			switch (event) {
				case "incident.created":
					statusHeader = "> `⛔` New incident created";
					color = 16711680; // Red
					reasonContent = payload.description || "No details provided";
					break;
				case "incident.resolved":
					statusHeader = "> `✅` Incident resolved";
					color = 65280; // Green
					reasonContent =
						payload.description || "The incident has been resolved.";
					break;
				case "incident.acknowledged":
					statusHeader = "> `👀` Incident acknowledged";
					color = 16776960; // Yellow/Orange
					reasonContent =
						payload.description || "The incident has been acknowledged.";
					break;
				case "incident.comment_added":
					statusHeader = "> `💬` New comment";
					color = 3447003; // Blue
					reasonLabel = "`💬` Comment";
					reasonContent = payload.message || "No content";
					break;
				default:
					statusHeader = `> Event: \`${event}\``;
					color = 9807270; // Grey
					reasonContent = JSON.stringify(payload, null, 2);
			}

			const embed = {
				color: color,
				description: statusHeader,
				fields: [
					{
						name: "`💻` Monitors",
						value: monitorLinks,
						inline: true,
					},
					{
						name: "`📅` Date",
						value: dateString,
						inline: true,
					},
					{
						name: "`⏰` Time",
						value: timeString,
						inline: true,
					},
					{
						name: reasonLabel,
						value: `\`\`\`\n${reasonContent}\n\`\`\``,
					},
				],
			};

			const components = [
				{
					type: 1,
					components: [
						{
							type: 2,
							style: 5, // Link Button
							label: "Manage Incident",
							url: incidentUrl,
						},
					],
				},
			];

			await fetch(config.webhookUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					embeds: [embed],
					components: components,
				}),
			});
		} catch (error) {
			// console.error(
			// 	`[Discord] Failed to send webhook to ${config.webhookUrl}`,
			// 	error,
			// );
		}
	},
};

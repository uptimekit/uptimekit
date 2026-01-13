import { ORPCError } from "@orpc/server";
import { db } from "@uptimekit/db";
import {
	CONFIG_DEFAULTS,
	configuration,
} from "@uptimekit/db/schema/configuration";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "../index";

export const configurationRouter = {
	list: adminProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/configuration",
				tags: ["Configuration"],
				summary: "List all configuration settings",
				description:
					"Retrieve all instance configuration settings. Admin only.",
			},
		})
		.handler(async () => {
			const items = await db.query.configuration.findMany();

			// Merge with defaults - database values take precedence
			const dbMap = new Map(items.map((i) => [i.key, i]));
			const mergedItems = Object.entries(CONFIG_DEFAULTS).map(
				([key, defaultValue]) => {
					const dbItem = dbMap.get(key);
					if (dbItem) {
						return dbItem;
					}
					return {
						id: `default-${key}`,
						key,
						value: defaultValue,
						createdAt: null,
						updatedAt: null,
					};
				},
			);

			// Add any extra items from DB that aren't in defaults
			for (const item of items) {
				if (!CONFIG_DEFAULTS[item.key]) {
					mergedItems.push(item);
				}
			}

			return { items: mergedItems };
		}),

	get: adminProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/configuration/{key}",
				tags: ["Configuration"],
				summary: "Get configuration value",
				description:
					"Retrieve a specific configuration value by key. Admin only.",
			},
		})
		.input(z.object({ key: z.string() }))
		.handler(async ({ input }) => {
			const item = await db.query.configuration.findFirst({
				where: eq(configuration.key, input.key),
			});

			if (!item) {
				throw new ORPCError("NOT_FOUND", {
					message: `Configuration key "${input.key}" not found`,
				});
			}

			return item;
		}),

	set: adminProcedure
		.meta({
			openapi: {
				method: "PUT",
				path: "/configuration/{key}",
				tags: ["Configuration"],
				summary: "Set configuration value",
				description: "Create or update a configuration value. Admin only.",
			},
		})
		.input(z.object({ key: z.string(), value: z.string() }))
		.handler(async ({ input }) => {
			const existing = await db.query.configuration.findFirst({
				where: eq(configuration.key, input.key),
			});

			if (existing) {
				const [updated] = await db
					.update(configuration)
					.set({ value: input.value })
					.where(eq(configuration.key, input.key))
					.returning();
				return updated;
			}

			const [created] = await db
				.insert(configuration)
				.values({
					id: crypto.randomUUID(),
					key: input.key,
					value: input.value,
				})
				.returning();

			return created;
		}),

	delete: adminProcedure
		.meta({
			openapi: {
				method: "DELETE",
				path: "/configuration/{key}",
				tags: ["Configuration"],
				summary: "Delete configuration value",
				description:
					"Remove a configuration value (reset to default). Admin only.",
			},
		})
		.input(z.object({ key: z.string() }))
		.handler(async ({ input }) => {
			const existing = await db.query.configuration.findFirst({
				where: eq(configuration.key, input.key),
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", {
					message: `Configuration key "${input.key}" not found`,
				});
			}

			await db.delete(configuration).where(eq(configuration.key, input.key));
			return { success: true };
		}),
};

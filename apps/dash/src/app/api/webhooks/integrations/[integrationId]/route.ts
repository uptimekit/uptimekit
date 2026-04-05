import { timingSafeEqual } from "node:crypto";
import { processAlertManagerWebhook } from "@uptimekit/api/pkg/integrations/definitions/alertmanager";
import {
	type AlertManagerConfig,
	AlertManagerPayloadSchema,
} from "@uptimekit/api/pkg/integrations/definitions/alertmanager-meta";
import { db } from "@uptimekit/db";
import { integrationConfig } from "@uptimekit/db/schema/integrations";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ integrationId: string }> },
) {
	const { integrationId } = await params;

	const config = await db.query.integrationConfig.findFirst({
		where: eq(integrationConfig.id, integrationId),
	});

	if (!config) {
		return NextResponse.json(
			{ error: "Integration not found" },
			{ status: 404 },
		);
	}

	if (!config.active) {
		return NextResponse.json(
			{ error: "Integration is not active" },
			{ status: 403 },
		);
	}

	const authHeader = request.headers.get("authorization");
	const configData = config.config as AlertManagerConfig;

	if (configData.bearerToken) {
		const expectedToken = `Bearer ${configData.bearerToken}`;
		if (!authHeader) {
			return NextResponse.json(
				{ error: "Invalid authorization token" },
				{ status: 401 },
			);
		}
		const expectedBuffer = Buffer.from(expectedToken);
		const authBuffer = Buffer.from(authHeader);
		if (
			expectedBuffer.length !== authBuffer.length ||
			!timingSafeEqual(expectedBuffer, authBuffer)
		) {
			return NextResponse.json(
				{ error: "Invalid authorization token" },
				{ status: 401 },
			);
		}
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	try {
		switch (config.type) {
			case "alertmanager": {
				const parseResult = AlertManagerPayloadSchema.safeParse(body);
				if (!parseResult.success) {
					console.error(
						"[Webhook] Invalid AlertManager payload:",
						parseResult.error.flatten(),
					);
					return NextResponse.json(
						{ error: "Invalid AlertManager payload" },
						{ status: 400 },
					);
				}
				const result = await processAlertManagerWebhook(
					configData,
					config.organizationId,
					parseResult.data,
				);
				return NextResponse.json({
					success: true,
					...result,
				});
			}
			default:
				return NextResponse.json(
					{ error: `Unknown integration type: ${config.type}` },
					{ status: 400 },
				);
		}
	} catch (error) {
		console.error("[Webhook] Error processing webhook:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

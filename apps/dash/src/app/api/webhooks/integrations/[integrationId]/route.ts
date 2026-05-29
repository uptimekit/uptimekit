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
import { useLogger, withEvlog } from "@/lib/evlog";

export const POST = withEvlog(async function POST(
  request: Request,
  { params }: { params: Promise<{ integrationId: string> } },
) {
  const logger = useLogger();
  const { integrationId } = await params;

  logger.set({ event: "webhook_received", integrationId });

  const config = await db.query.integrationConfig.findFirst({
    where: eq(integrationConfig.id, integrationId),
  });

  if (!config) {
    logger.set({ 
      event: "integration_not_found",
      integrationId
    });
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 },
    );
  }

  if (!config.active) {
    logger.set({ 
      event: "integration_inactive",
      integrationId
    });
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
      logger.set({ 
        event: "missing_auth_header",
        integrationId
      });
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
      logger.set({ 
        event: "invalid_auth_token",
        integrationId
      });
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
    logger.set({ 
      event: "invalid_json",
      integrationId
    });
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  logger.set({ 
    event: "processing_webhook",
    integrationId,
    type: config.type
  });

  try {
    switch (config.type) {
      case "alertmanager": {
        const parseResult = AlertManagerPayloadSchema.safeParse(body);
        if (!parseResult.success) {
          logger.set({ 
            event: "invalid_payload",
            integrationId,
            error: parseResult.error.flatten()
          });
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
        logger.set({ 
          event: "webhook_processed_success",
          integrationId
        });
        return NextResponse.json({
          success: true,
          ...result,
        });
      }
      default:
        logger.set({ 
          event: "unknown_integration_type",
          integrationId,
          type: config.type
        });
        return NextResponse.json(
          { error: `Unknown integration type: ${config.type}` },
          { status: 400 },
        );
    }
  } catch (error) {
    logger.set({ 
      event: "webhook_error",
      integrationId,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});

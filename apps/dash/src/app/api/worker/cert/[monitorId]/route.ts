import { eventBus } from "@uptimekit/api/lib/events";
import { authenticateWorker, isAuthError } from "@uptimekit/api/pkg/worker";
import { db } from "@uptimekit/db";
import { monitor } from "@uptimekit/db/schema/monitors";
import { sslCertificateNotification } from "@uptimekit/db/schema/ssl-notifications";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { useLogger, withEvlog } from "@/lib/evlog";

interface CertificateInfo {
	domain: string;
	issuer: string;
	validFrom: string;
	validTo: string;
	daysUntilExpiry: number;
	isValid: boolean;
	error?: string;
}

/**
 * Decides whether an SSL expiry notification should be sent for a certificate.
 *
 * @param daysUntilExpiry - Number of days remaining until the certificate expires; negative values indicate the certificate is already expired.
 * @param lastNotification - The most recent notification record for this domain and monitor, or `null` if none. `daysUntilExpiryAtNotification` should be a string parseable as a number representing the days until expiry at the time of that notification.
 * @param threshold - The configured notification threshold in days; certificates with more days remaining than this value are not notified.
 * @returns `true` if a notification should be sent, `false` otherwise.
 *
 * Behavior notes:
 * - Always notify if the certificate is already expired (`daysUntilExpiry < 0`).
 * - Do not notify if `daysUntilExpiry` is greater than `threshold`.
 * - If there is no prior notification, notify.
 * - If `daysUntilExpiry` is 7 or fewer, require at least 1 day since the last notification (based on the last recorded days-until-expiry) to notify again.
 * - If `daysUntilExpiry` is greater than 7 (and within `threshold`), require at least 7 days since the last notification to notify again.
 */
function shouldSendNotification(
	daysUntilExpiry: number,
	lastNotification: {
		lastNotifiedAt: Date;
		daysUntilExpiryAtNotification: string;
	} | null,
	threshold: number,
): boolean {
	if (daysUntilExpiry < 0) {
		return true;
	}

	if (daysUntilExpiry > threshold) {
		return false;
	}

	if (!lastNotification) {
		return true;
	}

	const lastDays = Number.parseFloat(
		lastNotification.daysUntilExpiryAtNotification,
	);
	const daysSinceLastNotification = lastDays - daysUntilExpiry;

	if (daysUntilExpiry <= 7) {
		return daysSinceLastNotification >= 1;
	}

	return daysSinceLastNotification >= 7;
}

/**
 * Handle POST requests from worker agents reporting an SSL certificate's status for a specific monitor and emit notifications when appropriate.
 *
 * Attempts worker authentication, validates the target monitor, parses and validates the JSON payload containing certificate info, respects the monitor's SSL-check configuration and notification threshold, updates or inserts a last-notified record if a notification should be sent, emits a "monitor.ssl.expiring" event with certificate and monitor metadata when notifying, and returns a compact JSON status object.
 *
 * @param request - The incoming HTTP request carrying the certificate report JSON
 * @param params - An object whose `monitorId` route parameter identifies the target monitor
 * @returns A NextResponse with a JSON body. On success the body includes `success`, `notified`, `threshold`, `daysUntilExpiry`, and `nextNotificationIn` when applicable. On error the body includes an `error` message and an appropriate HTTP status (e.g., authentication failure, monitor not found, invalid JSON, or missing required fields).
 */
export const POST = withEvlog(async function POST(
  request: Request,
  { params }: { params: Promise<{ monitorId: string> } },
) {
  const logger = useLogger();
  const authResult = await authenticateWorker(request);

  if (isAuthError(authResult)) {
    logger.set({ 
      event: "auth_failed", 
      error: authResult.error,
      status: authResult.status
    });
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const { monitorId } = await params;

  const monitorRecord = await db.query.monitor.findFirst({
    where: eq(monitor.id, monitorId),
  });

  if (!monitorRecord) {
    logger.set({ 
      event: "monitor_not_found",
      monitorId
    });
    return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
  }

  let body: CertificateInfo;
  try {
    body = await request.json();
  } catch {
    logger.set({ 
      event: "invalid_json",
      error: "Invalid JSON body"
    });
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.domain || body.daysUntilExpiry === undefined) {
    logger.set({ 
      event: "missing_required_fields",
      error: "Missing required fields: domain, daysUntilExpiry"
    });
    return NextResponse.json(
      { error: "Missing required fields: domain, daysUntilExpiry" },
      { status: 400 },
    );
  }

  logger.set({ 
    event: "received_certificate_info",
    domain: body.domain,
    daysUntilExpiry: body.daysUntilExpiry
  });

  const config = monitorRecord.config as {
    checkSsl?: boolean;
    sslCertExpiryNotificationDays?: number;
  };

  const checkSsl = config.checkSsl ?? true;
  const notificationThreshold = config.sslCertExpiryNotificationDays ?? 30;

  if (!checkSsl) {
    logger.set({ 
      event: "ssl_checking_disabled",
      monitorId
    });
    return NextResponse.json({
      success: true,
      message: "SSL checking disabled for this monitor",
    });
  }

  const lastNotification = await db.query.sslCertificateNotification.findFirst({
    where: and(
      eq(sslCertificateNotification.monitorId, monitorId),
      eq(sslCertificateNotification.domain, body.domain),
    ),
    orderBy: (table, { desc }) => [desc(table.lastNotifiedAt)],
  });

  const shouldNotify =
    body.error ||
    !body.isValid ||
    shouldSendNotification(
      body.daysUntilExpiry,
      lastNotification ?? null,
      notificationThreshold,
    );

  logger.set({ 
    event: "should_notify_decision",
    shouldNotify,
    error: body.error,
    isValid: body.isValid,
    daysUntilExpiry: body.daysUntilExpiry,
    threshold: notificationThreshold
  });

  if (shouldNotify) {
    const now = new Date();

    if (lastNotification) {
      await db
        .update(sslCertificateNotification)
        .set({
          lastNotifiedAt: now,
          daysUntilExpiryAtNotification: body.daysUntilExpiry.toString(),
          updatedAt: now,
        })
        .where(eq(sslCertificateNotification.id, lastNotification.id));
    } else {
      await db.insert(sslCertificateNotification).values({
        id: crypto.randomUUID(),
        monitorId: monitorRecord.id,
        domain: body.domain,
        lastNotifiedAt: now,
        daysUntilExpiryAtNotification: body.daysUntilExpiry.toString(),
      });
    }

    logger.set({ 
      event: "emitting_ssl_expiring_event",
      monitorId: monitorRecord.id,
      organizationId: monitorRecord.organizationId,
      domain: body.domain
    });

    eventBus.emit("monitor.ssl.expiring", {
      monitorId: monitorRecord.id,
      organizationId: monitorRecord.organizationId,
      monitorName: monitorRecord.name,
      domain: body.domain,
      issuer: body.issuer,
      validFrom: body.validFrom,
      validTo: body.validTo,
      daysUntilExpiry: body.daysUntilExpiry,
      isValid: body.isValid,
      error: body.error,
      threshold: notificationThreshold,
    });
  }

  logger.set({ 
    event: "returning_response",
    success: true,
    notified: shouldNotify,
    threshold: notificationThreshold,
    daysUntilExpiry: body.daysUntilExpiry
  });

  return NextResponse.json({
    success: true,
    notified: shouldNotify,
    threshold: notificationThreshold,
    daysUntilExpiry: body.daysUntilExpiry,
    nextNotificationIn: shouldNotify
      ? body.daysUntilExpiry > 7
        ? 7
        : 1
      : undefined,
  });
});

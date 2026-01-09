import { eventBus } from "@uptimekit/api/lib/events";
import { authenticateWorker, isAuthError } from "@uptimekit/api/pkg/worker";
import { db } from "@uptimekit/db";
import { monitor } from "@uptimekit/db/schema/monitors";
import { sslCertificateNotification } from "@uptimekit/db/schema/ssl-notifications";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

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
 * Determines if we should send a notification based on:
 * 1. Days until expiry
 * 2. Last notification time
 * 3. 7-day interval rule for notifications > 7 days out
 */
function shouldSendNotification(
	daysUntilExpiry: number,
	lastNotification: {
		lastNotifiedAt: Date;
		daysUntilExpiryAtNotification: string;
	} | null,
	threshold: number,
): boolean {
	// Always notify if certificate has errors or is invalid
	if (daysUntilExpiry < 0) {
		return true;
	}

	// Don't notify if we're still above the threshold
	if (daysUntilExpiry > threshold) {
		return false;
	}

	// If no previous notification, send one
	if (!lastNotification) {
		return true;
	}

	const lastDays = Number.parseFloat(
		lastNotification.daysUntilExpiryAtNotification,
	);
	const daysSinceLastNotification = lastDays - daysUntilExpiry;

	// If we're within 7 days of expiry, notify every day
	if (daysUntilExpiry <= 7) {
		// Notify if at least 1 day has passed
		return daysSinceLastNotification >= 1;
	}

	// For > 7 days, notify every 7 days (30→23→16→9→2)
	return daysSinceLastNotification >= 7;
}

export async function POST(
	request: Request,
	{ params }: { params: { monitorId: string } },
) {
	const authResult = await authenticateWorker(request);

	if (isAuthError(authResult)) {
		return NextResponse.json(
			{ error: authResult.error },
			{ status: authResult.status },
		);
	}

	const { monitorId } = params;

	// Verify monitor exists
	const monitorRecord = await db.query.monitor.findFirst({
		where: eq(monitor.id, monitorId),
	});

	if (!monitorRecord) {
		return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
	}

	let body: CertificateInfo;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	// Validate required fields
	if (!body.domain || body.daysUntilExpiry === undefined) {
		return NextResponse.json(
			{ error: "Missing required fields: domain, daysUntilExpiry" },
			{ status: 400 },
		);
	}

	// Get the SSL cert expiry notification threshold from monitor config
	const config = monitorRecord.config as {
		checkSsl?: boolean;
		sslCertExpiryNotificationDays?: number;
	};

	const checkSsl = config.checkSsl ?? true;
	const notificationThreshold = config.sslCertExpiryNotificationDays ?? 30;

	// Only process if SSL checking is enabled
	if (!checkSsl) {
		return NextResponse.json({
			success: true,
			message: "SSL checking disabled for this monitor",
		});
	}

	// Get last notification for this monitor and domain
	const lastNotification = await db.query.sslCertificateNotification.findFirst({
		where: and(
			eq(sslCertificateNotification.monitorId, monitorId),
			eq(sslCertificateNotification.domain, body.domain),
		),
		orderBy: (table, { desc }) => [desc(table.lastNotifiedAt)],
	});

	// Check if we should send a notification
	const shouldNotify =
		body.error ||
		!body.isValid ||
		shouldSendNotification(
			body.daysUntilExpiry,
			lastNotification ?? null,
			notificationThreshold,
		);

	if (shouldNotify) {
		const now = new Date();

		// Upsert notification record
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

		// Emit event for certificate expiration warning
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
}

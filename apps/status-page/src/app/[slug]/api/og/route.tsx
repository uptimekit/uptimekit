/** biome-ignore-all lint/a11y/noSvgWithoutTitle: no need to pass it */

import { createLogger } from "@uptimekit/api/lib/logger";
import { ImageResponse } from "next/og";
import {
	getActiveMaintenances,
	getActiveStatusPageReports,
	getMonitorStatus,
	getStatusPageBySlug,
} from "@/lib/db-queries";

const logger = createLogger("STATUS-PAGE");

export const runtime = "nodejs";

type StatusType =
	| "operational"
	| "degraded"
	| "partial_outage"
	| "major_outage"
	| "maintenance"
	| "unknown";

const statusColors: Record<StatusType, string> = {
	operational: "#22c55e",
	degraded: "#eab308",
	partial_outage: "#f97316",
	major_outage: "#ef4444",
	maintenance: "#3b82f6",
	unknown: "#6b7280",
};

const statusText: Record<StatusType, string> = {
	operational: "All services are online",
	degraded: "Some systems are degraded",
	partial_outage: "Partial system outage",
	major_outage: "Major system outage",
	maintenance: "Maintenance in progress",
	unknown: "Status unknown",
};

function getSlugFromOgPath(pathname: string): string | undefined {
	const segments = pathname.split("/").filter(Boolean);

	if (
		segments.length >= 3 &&
		segments.at(-2) === "api" &&
		segments.at(-1) === "og"
	) {
		return segments.at(-3);
	}

	return undefined;
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ slug: string }> },
) {
	const { slug: routeSlug } = await params;
	const slug = routeSlug || getSlugFromOgPath(new URL(request.url).pathname);

	if (!slug) {
		return new ImageResponse(
			<div
				style={{
					fontSize: 48,
					background: "#2C2C2C",
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: "white",
				}}
			>
				Status Page
			</div>,
			{
				width: 1200,
				height: 630,
			},
		);
	}

	const pageConfig = await getStatusPageBySlug(slug);

	if (!pageConfig) {
		return new ImageResponse(
			<div
				style={{
					fontSize: 48,
					background: "#2C2C2C",
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: "white",
				}}
			>
				Status Page Not Found
			</div>,
			{
				width: 1200,
				height: 630,
			},
		);
	}

	const [activeReports, activeMaintenances] = await Promise.all([
		getActiveStatusPageReports(pageConfig.id),
		getActiveMaintenances(pageConfig.id),
	]);

	// Calculate Status per monitor
	const monitorStatuses = await Promise.all(
		pageConfig.monitors.map(async (pm): Promise<StatusType> => {
			// Check active incidents
			const activeReport = activeReports.find((r: any) =>
				r.affectedMonitors.some((am: any) => am.monitorId === pm.monitorId),
			);

			if (activeReport) {
				return "major_outage";
			}

			// Check maintenance
			const isUnderMaintenance = activeMaintenances.some((m) =>
				m.monitors.some((mm: any) => mm.monitorId === pm.monitorId),
			);

			if (isUnderMaintenance) {
				return "maintenance";
			}

			// Check heartbeat
			const lastCheck = await getMonitorStatus(pm.monitorId);
			if (lastCheck && lastCheck.status === "down") {
				return "major_outage";
			}

			return "operational";
		}),
	);

	// Aggregate Status
	let worstStatus: StatusType = "operational";

	if (monitorStatuses.includes("major_outage")) {
		worstStatus = "major_outage";
	} else if (monitorStatuses.includes("maintenance")) {
		worstStatus = "maintenance";
	} else if (monitorStatuses.includes("partial_outage")) {
		worstStatus = "partial_outage";
	} else if (monitorStatuses.includes("degraded")) {
		worstStatus = "degraded";
	}

	// Check if there are active global incidents not tied to specific monitors
	const globalIncident = activeReports.some(
		(r: any) => r.affectedMonitors.length === 0,
	);
	if (globalIncident && worstStatus !== "major_outage") {
		worstStatus = "major_outage";
	}

	const color = statusColors[worstStatus];
	const text = statusText[worstStatus];

	// Fetch Logo safely
	let logoSrc = "https://r2.uptimekit.dev/logos/uptimekit.svg";
	try {
		const logoRes = await fetch(logoSrc);
		if (logoRes.ok) {
			const logoBuffer = await logoRes.arrayBuffer();
			const base64 = Buffer.from(logoBuffer).toString("base64");
			logoSrc = `data:image/svg+xml;base64,${base64}`;
		}
	} catch (e) {
		logger.error("Failed to fetch logo for OG image", e);
	}

	return new ImageResponse(
		<div
			style={{
				background: "#1A1A1A", // Matches sidebar oklch(0.18 0 0)
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: "Inter, sans-serif",
				position: "relative",
			}}
		>
			{/* Status Icon Container */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					width: "120px",
					height: "120px",
					borderRadius: "50%",
					backgroundColor: color,
					boxShadow: `0 0 40px -10px ${color}`,
					marginBottom: "40px",
				}}
			>
				{/* Inner Icon - Simple SVGs to avoid crashing */}
				{worstStatus === "operational" ? (
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="64"
						height="64"
						viewBox="0 0 24 24"
						fill="none"
						stroke="white"
						strokeWidth="3"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M20 6 9 17l-5-5" />
					</svg>
				) : worstStatus === "maintenance" ? (
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="56"
						height="56"
						viewBox="0 0 24 24"
						fill="none"
						stroke="white"
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
					</svg>
				) : worstStatus === "major_outage" ? (
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="56"
						height="56"
						viewBox="0 0 24 24"
						fill="none"
						stroke="white"
						strokeWidth="3"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
				) : (
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="56"
						height="56"
						viewBox="0 0 24 24"
						fill="none"
						stroke="white"
						strokeWidth="3"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M12 9v4" />
						<path d="M12 17h.01" />
						<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
					</svg>
				)}
			</div>

			{/* Status Text */}
			<div
				style={{
					color: "white",
					fontSize: 48,
					fontWeight: 700,
					textAlign: "center",
					letterSpacing: "-0.01em",
					padding: "0 40px",
					textShadow: "0 4px 20px rgba(0,0,0,0.5)",
				}}
			>
				{text}
			</div>

			{/* Footer */}
			<div
				style={{
					position: "absolute",
					bottom: "50px",
					display: "flex",
					flexDirection: "row",
					alignItems: "center",
					gap: "12px",
				}}
			>
				<div
					style={{
						color: "#a1a1aa", // Zinc 400
						fontSize: 24,
						fontWeight: 500,
					}}
				>
					Powered by
				</div>
				{/* biome-ignore lint/performance/noImgElement: ImageResponse markup uses raw img */}
				<img src={logoSrc} alt="UptimeKit" height={32} />
				<div
					style={{
						color: "white",
						fontSize: 26,
						fontWeight: 700,
					}}
				>
					UptimeKit
				</div>
			</div>
		</div>,
		{
			width: 1200,
			height: 630,
		},
	);
}

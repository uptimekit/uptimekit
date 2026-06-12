import { assertSafePublicHttpUrl } from "@uptimekit/api/lib/safe-url";
import type { StatusType } from "@/themes/types";
import { calculateAggregateStatus } from "./status-utils";

const EXTERNAL_MONITOR_TYPES = new Set(["instatus"]);

interface ExternalStatusComponent {
	id?: unknown;
	name?: unknown;
	status?: unknown;
}

interface ExternalStatusResponse {
	components?: ExternalStatusComponent[];
}

export function isExternalMonitorType(type: unknown) {
	return typeof type === "string" && EXTERNAL_MONITOR_TYPES.has(type);
}

function normalizeComponentName(name: string) {
	return name.trim().toLowerCase();
}

function getInstatusComponentsUrl(statusPageUrl: string) {
	const url = new URL(statusPageUrl);
	url.pathname = "/v3/components.json";
	url.search = "";
	url.hash = "";

	return url.toString();
}

function getExternalStatusPageUrl(config: unknown) {
	if (!config || typeof config !== "object") {
		return null;
	}

	const url = (config as { url?: unknown }).url;
	if (typeof url !== "string") {
		return null;
	}

	try {
		const parsedUrl = new URL(url);
		if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
			return null;
		}

		return parsedUrl.toString();
	} catch {
		return null;
	}
}

function getExternalComponentName(config: unknown) {
	if (!config || typeof config !== "object") {
		return null;
	}

	const hostname = (config as { hostname?: unknown }).hostname;
	if (typeof hostname !== "string") {
		return null;
	}

	const trimmed = hostname.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function getExternalComponentId(config: unknown) {
	if (!config || typeof config !== "object") {
		return null;
	}

	const componentId = (config as { componentId?: unknown }).componentId;
	if (typeof componentId !== "string") {
		return null;
	}

	const trimmed = componentId.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function isExternalMonitor(monitor: {
	type?: string | null;
	config?: unknown;
}) {
	return (
		isExternalMonitorType(monitor.type) ||
		getExternalComponentId(monitor.config) !== null
	);
}

export function mapExternalComponentStatus(status: unknown): StatusType {
	const normalized =
		typeof status === "string"
			? status
					.trim()
					.toUpperCase()
					.replaceAll(/[\s_-]/g, "")
			: "";

	switch (normalized) {
		case "OPERATIONAL":
			return "operational";
		case "DEGRADED":
		case "DEGRADEDPERFORMANCE":
			return "degraded";
		case "PARTIALOUTAGE":
		case "PARTIALSERVICEOUTAGE":
			return "partial_outage";
		case "MAJOROUTAGE":
		case "OUTAGE":
		case "DOWN":
		case "UNAVAILABLE":
			return "major_outage";
		case "MAINTENANCE":
		case "UNDERMAINTENANCE":
			return "maintenance";
		default:
			return "unknown";
	}
}

async function getInstatusComponents(statusPageUrl: string) {
	try {
		await assertSafePublicHttpUrl(statusPageUrl, {
			label: "Status page URL",
		});

		const response = await fetch(getInstatusComponentsUrl(statusPageUrl), {
			next: { revalidate: 60 },
			redirect: "error",
		});

		if (!response.ok) {
			throw new Error(`Instatus returned ${response.status}`);
		}

		const payload = (await response.json()) as ExternalStatusResponse;
		return Array.isArray(payload.components) ? payload.components : [];
	} catch (error) {
		console.error(
			"[external-status] Failed to fetch Instatus components",
			error,
		);
		return [];
	}
}

export async function getExternalMonitorStatus(monitor: {
	type?: string | null;
	config?: unknown;
}): Promise<StatusType | undefined> {
	if (!isExternalMonitor(monitor)) {
		return undefined;
	}

	const statusPageUrl = getExternalStatusPageUrl(monitor.config);
	const componentId = getExternalComponentId(monitor.config);
	const componentName = getExternalComponentName(monitor.config);
	if (!statusPageUrl) {
		return "unknown";
	}

	if (!componentId && !componentName) {
		return "unknown";
	}

	const components = await getInstatusComponents(statusPageUrl);
	const matchingComponents = componentId
		? components.filter((component) => component.id === componentId)
		: components.filter(
				(component) =>
					typeof component.name === "string" &&
					normalizeComponentName(component.name) ===
						normalizeComponentName(componentName ?? ""),
			);
	const statuses = matchingComponents.map((component) =>
		mapExternalComponentStatus(component.status),
	);

	return statuses.length > 0 ? calculateAggregateStatus(statuses) : "unknown";
}

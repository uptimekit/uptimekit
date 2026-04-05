export const INCIDENT_HISTORY_PERIODS = ["30d", "90d", "365d", "all"] as const;

export type IncidentHistoryPeriod = (typeof INCIDENT_HISTORY_PERIODS)[number];

export function isIncidentHistoryPeriod(
	value: string | undefined,
): value is IncidentHistoryPeriod {
	return INCIDENT_HISTORY_PERIODS.includes(value as IncidentHistoryPeriod);
}

export function parseIncidentHistoryPeriod(
	value: string | undefined,
): IncidentHistoryPeriod {
	return isIncidentHistoryPeriod(value) ? value : "all";
}

export function getIncidentHistoryCutoff(
	period: IncidentHistoryPeriod,
	now = new Date(),
): Date | undefined {
	if (period === "all") {
		return undefined;
	}

	const cutoff = new Date(now);

	if (period === "30d") {
		cutoff.setDate(cutoff.getDate() - 30);
	} else if (period === "90d") {
		cutoff.setDate(cutoff.getDate() - 90);
	} else if (period === "365d") {
		cutoff.setDate(cutoff.getDate() - 365);
	}

	return cutoff;
}

export function getIncidentHistoryLabel(period: IncidentHistoryPeriod): string {
	switch (period) {
		case "30d":
			return "30 days";
		case "90d":
			return "90 days";
		case "365d":
			return "365 days";
		default:
			return "All time";
	}
}

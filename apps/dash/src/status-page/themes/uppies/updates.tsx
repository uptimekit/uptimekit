import { IncidentHistoryPeriodSelector } from "@/status-page/components/incident-history-period-selector";
import { getIncidentHistoryLabel } from "@/status-page/lib/incident-history";
import { buildPath } from "@/status-page/lib/route-utils";
import type { ThemeUpdatesProps } from "../types";
import { OpenIncident, Timeline, UppiesShell } from "./components";
import "./style.css";

export default function UppiesUpdates({ data }: ThemeUpdatesProps) {
    const { config, incidentsByDate, activeIssues, selectedPeriod } = data;
    const isEmpty = Object.keys(incidentsByDate).length === 0;

    return (
        <UppiesShell config={config} section="incidents">
            <h1 className="title-row">incident history</h1>
            <IncidentHistoryPeriodSelector
                basePath={buildPath("/updates", config.routeSlug)}
                selectedPeriod={selectedPeriod}
            />
            {activeIssues.map((incident) => (
                <OpenIncident key={incident.id} incident={incident} />
            ))}
            {isEmpty ? (
                <p className="muted">
                    {selectedPeriod === "all"
                        ? "no incidents yet."
                        : `no incidents in the last ${getIncidentHistoryLabel(selectedPeriod)}.`}
                </p>
            ) : (
                <Timeline incidentsByDate={incidentsByDate} />
            )}
        </UppiesShell>
    );
}

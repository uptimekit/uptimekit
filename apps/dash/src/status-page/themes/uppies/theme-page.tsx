import { Fragment } from "react";
import { LinkedPagesSection } from "@/status-page/components/linked-pages-section";
import { buildPath } from "@/status-page/lib/route-utils";
import { formatEventDateTime } from "@/status-page/lib/status-event";
import type { ThemePageProps } from "../types";
import {
    ComponentRow,
    MaintenanceCard,
    OpenIncident,
    StatusIcon,
    Timeline,
    UppiesShell,
} from "./components";
import { statusViews } from "./look";
import "./style.css";

export default function UppiesTheme({ data }: ThemePageProps) {
    const {
        config,
        overallStatus,
        monitorGroups,
        activeIssues,
        scheduledMaintenances,
        pastIncidents,
        linkedPages,
        lastUpdated,
    } = data;
    const { design } = config;
    const look = design.uppies;
    const allIncidents = Object.values(pastIncidents).flat();
    const overall = statusViews[overallStatus];
    const hasComponents = monitorGroups.some(
        (group) => group.monitors.length > 0,
    );

    return (
        <UppiesShell config={config} section="status">
            <section
                className={`banner banner-${overall.state}`}
                aria-label="current status"
            >
                {look.showStatusIcon ? (
                    <StatusIcon icon={overall.icon} />
                ) : null}
                <h1 className="banner-text">{overall.banner}</h1>
            </section>
            <div className="status-meta">
                {look.tagline ? <p className="muted">{look.tagline}</p> : null}
                <p className="meta status-checked">
                    last updated{" "}
                    <time dateTime={lastUpdated}>
                        {formatEventDateTime(new Date(lastUpdated))} UTC
                    </time>
                </p>
            </div>

            {activeIssues.map((incident) => (
                <OpenIncident key={incident.id} incident={incident} />
            ))}

            {scheduledMaintenances.length > 0 ? (
                <section aria-labelledby="maintenance-heading">
                    <h2 id="maintenance-heading">planned maintenance</h2>
                    <ul className="cards">
                        {scheduledMaintenances.map((maintenance) => (
                            <MaintenanceCard
                                key={maintenance.id}
                                maintenance={maintenance}
                            />
                        ))}
                    </ul>
                </section>
            ) : null}

            <section aria-labelledby="components-heading">
                <h2 className="title-ruled" id="components-heading">
                    components
                </h2>
                {hasComponents ? (
                    <ul className="components">
                        {monitorGroups.map(({ group, monitors }) => (
                            <Fragment key={group?.id ?? "ungrouped"}>
                                {group ? (
                                    <li className="category">
                                        <h3>{group.name}</h3>
                                    </li>
                                ) : null}
                                {monitors.map((monitor) => (
                                    <ComponentRow
                                        key={monitor.id}
                                        monitor={monitor}
                                        barDays={design.barDays}
                                        digits={design.percentDigits}
                                        incidents={allIncidents}
                                    />
                                ))}
                            </Fragment>
                        ))}
                    </ul>
                ) : (
                    <p className="muted">nothing is monitored here yet.</p>
                )}
            </section>

            <LinkedPagesSection linkedPages={linkedPages} className="mb-0" />

            <section aria-labelledby="history-heading">
                <div className="title-row title-ruled">
                    <h2 id="history-heading">past incidents</h2>
                    <a
                        className="meta"
                        href={buildPath("/updates", config.routeSlug)}
                    >
                        incident history
                    </a>
                </div>
                {Object.keys(pastIncidents).length > 0 ? (
                    <Timeline incidentsByDate={pastIncidents} />
                ) : (
                    <p className="muted">no recent incidents.</p>
                )}
            </section>
        </UppiesShell>
    );
}

import type { CSSProperties, ReactNode } from "react";
import { SubscribeForm } from "@/status-page/components/subscribe-form";
import { buildPath } from "@/status-page/lib/route-utils";
import { formatEventDateTime } from "@/status-page/lib/status-event";
import { cn } from "@/status-page/lib/utils";
import type {
    Incident,
    Maintenance,
    Monitor,
    StatusPageConfig,
} from "../types";
import {
    dayTip,
    findDayIncident,
    parseNavLinks,
    statusViews,
    type UppiesIcon,
} from "./look";

const UPPIES_URL = "https://github.com/schmayterling/uppies";

export function UppiesShell({
    config,
    section,
    children,
}: {
    config: StatusPageConfig;
    section: "status" | "incidents";
    children: ReactNode;
}) {
    const look = config.design.uppies;

    return (
        <div
            className="uppies"
            data-surface={look.surface}
            data-corners={look.corners}
            data-font={look.font}
            style={{ "--up-hue": look.accentHue } as CSSProperties}
        >
            <div className="column">
                <SiteBar config={config} section={section} />
                {look.announcement.trim() ? (
                    <aside
                        className={`page-announcement announcement-${look.announcementColor}`}
                        aria-label="announcement"
                    >
                        {look.announcement}
                    </aside>
                ) : null}
                <main>{children}</main>
                <footer className="page-foot meta">
                    {look.footerText ? <p>{look.footerText}</p> : null}
                    <p>
                        powered by UptimeKit. theme from{" "}
                        <a href={UPPIES_URL} rel="noopener">
                            uppies
                        </a>
                        .
                    </p>
                </footer>
            </div>
        </div>
    );
}

function SiteBar({
    config,
    section,
}: {
    config: StatusPageConfig;
    section: "status" | "incidents";
}) {
    const { design, routeSlug } = config;

    return (
        <header className="site-bar">
            <a className="site-brand" href={buildPath("/", routeSlug)}>
                {design.logoUrl ? (
                    // biome-ignore lint/performance/noImgElement: logos are arbitrary external URLs
                    <img className="logo" src={design.logoUrl} alt="" />
                ) : null}
                {config.name}
            </a>
            <nav className="site-links" aria-label={config.name}>
                <a
                    href={buildPath("/", routeSlug)}
                    aria-current={section === "status" ? "page" : undefined}
                >
                    status
                </a>
                <a
                    href={buildPath("/updates", routeSlug)}
                    aria-current={section === "incidents" ? "page" : undefined}
                >
                    incidents
                </a>
                {parseNavLinks(design.uppies.navLinks).map((link) => (
                    <a key={link.url} href={link.url} rel="noopener">
                        {link.label}
                    </a>
                ))}
                {design.contactUrl ? (
                    <a href={design.contactUrl} rel="noopener">
                        get in touch
                    </a>
                ) : null}
                {design.websiteUrl ? (
                    <a href={design.websiteUrl} rel="noopener">
                        back to {config.name}
                    </a>
                ) : null}
                <SubscribeForm
                    statusPageId={config.id}
                    slug={routeSlug}
                    className="site-subscribe"
                    variant="spark"
                    allowEmailSubscriptions={design.allowSubscriptions}
                />
            </nav>
        </header>
    );
}

// A round status icon, drawn as uppies draws it. The wrench is Lucide's.
export function StatusIcon({ icon }: { icon: UppiesIcon }) {
    return (
        <svg
            className={`status-icon status-icon-${icon}`}
            viewBox="0 0 48 48"
            width="48"
            height="48"
            aria-hidden="true"
        >
            <circle cx="24" cy="24" r="21" />
            {icon === "check" ? <path d="M15 25l6 6 12-13" /> : null}
            {icon === "warning" ? (
                <>
                    <path d="M24 13v14" />
                    <circle className="status-dot" cx="24" cy="34" r="2" />
                </>
            ) : null}
            {icon === "cross" ? <path d="M17 17l14 14M31 17L17 31" /> : null}
            {icon === "wrench" ? (
                <path
                    transform="translate(12 12)"
                    d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
                />
            ) : null}
            {icon === "dash" ? <path d="M16 24h16" /> : null}
        </svg>
    );
}

// A state is a word, a colour and a shape together.
function Mark({ state }: { state: string }) {
    return (
        <svg
            className="mark"
            viewBox="0 0 12 12"
            width="12"
            height="12"
            aria-hidden="true"
        >
            {state === "ok" ? <circle cx="6" cy="6" r="5" /> : null}
            {state === "warn" ? <path d="M6 1 11.5 11H.5Z" /> : null}
            {state === "down" ? (
                <rect x="1" y="1" width="10" height="10" rx="2" />
            ) : null}
            {state === "none" ? (
                <circle className="hollow" cx="6" cy="6" r="4" />
            ) : null}
        </svg>
    );
}

export function ComponentRow({
    monitor,
    barDays,
    digits,
    incidents,
}: {
    monitor: Monitor;
    barDays: number;
    digits: number;
    incidents: Incident[];
}) {
    const view = statusViews[monitor.currentStatus];
    const uptime = `${monitor.avgUptime.toFixed(digits)}% uptime`;

    return (
        <li className="component">
            <div className="component-head">
                <span className="component-name">{monitor.name}</span>
                <span className={`state state-${view.state}`}>
                    <Mark state={view.state} />
                    {view.word}
                </span>
            </div>
            {monitor.description ? (
                <p className="component-description meta">
                    {monitor.description}
                </p>
            ) : null}
            {monitor.displayStyle === "history" ? (
                <>
                    <div
                        className="strip"
                        role="img"
                        aria-label={`uptime over the last ${barDays} days: ${uptime}`}
                    >
                        {monitor.history.map((day) => {
                            const dayProps = {
                                className: `day day-${statusViews[day.status].day}`,
                                "data-tip": dayTip(day, digits),
                                tabIndex: -1,
                            };
                            const incident = findDayIncident(
                                day,
                                monitor.id,
                                incidents,
                            );
                            return incident ? (
                                <a
                                    key={day.date}
                                    href={incident.detailsLink}
                                    {...dayProps}
                                />
                            ) : (
                                <span key={day.date} {...dayProps} />
                            );
                        })}
                    </div>
                    <div className="strip-legend meta">
                        <span className={barDays > 30 ? "wide-only" : ""}>
                            {barDays} days ago
                        </span>
                        {barDays > 30 ? (
                            <span className="narrow-only">30 days ago</span>
                        ) : null}
                        <span>{uptime}</span>
                        <span>today</span>
                    </div>
                </>
            ) : null}
        </li>
    );
}

function ImpactChips({ incident }: { incident: Incident }) {
    return (
        <p className="chips">
            {incident.severity !== "maintenance" ? (
                <span className="chip chip-plain">
                    {incident.severity} impact
                </span>
            ) : null}
            <span className="chip chip-plain">{incident.status}</span>
            {incident.monitors.map(({ monitor }) => (
                <span key={monitor.id} className="chip chip-plain">
                    {monitor.name}
                </span>
            ))}
        </p>
    );
}

function Updates({ incident }: { incident: Incident }) {
    if (incident.activities.length === 0) return null;
    const dotClass = incident.endedAt ? undefined : "update-open";

    return (
        <ol className="updates">
            {incident.activities.map((activity) => (
                <li key={activity.id} className={dotClass}>
                    <p className="update-head">
                        <time
                            className="meta"
                            dateTime={new Date(
                                activity.createdAt,
                            ).toISOString()}
                        >
                            {formatEventDateTime(activity.createdAt)} UTC
                        </time>
                    </p>
                    <p className="update-body">{activity.message}</p>
                </li>
            ))}
        </ol>
    );
}

export function OpenIncident({
    incident,
    as: Heading = "h2",
}: {
    incident: Incident;
    as?: "h1" | "h2";
}) {
    return (
        <article
            className={cn("incident", !incident.endedAt && "incident-open")}
        >
            <Heading>{incident.title}</Heading>
            <p className="meta">
                started {formatEventDateTime(incident.startedAt)} UTC
                {incident.endedAt
                    ? `, resolved ${formatEventDateTime(incident.endedAt)} UTC`
                    : null}
            </p>
            <ImpactChips incident={incident} />
            <Updates incident={incident} />
        </article>
    );
}

export function MaintenanceCard({ maintenance }: { maintenance: Maintenance }) {
    const running = maintenance.status === "in_progress";

    return (
        <li
            className={cn("incident maintenance", running && "maintenance-now")}
        >
            <h3>
                <a href={maintenance.detailsLink}>{maintenance.title}</a>
                {running ? <span className="chip">under way</span> : null}
            </h3>
            <p className="meta">
                {formatEventDateTime(maintenance.startAt)} UTC
                {maintenance.endAt
                    ? ` to ${formatEventDateTime(maintenance.endAt)} UTC`
                    : null}
            </p>
            {maintenance.monitors.length > 0 ? (
                <p className="chips">
                    {maintenance.monitors.map(({ monitor }) => (
                        <span key={monitor.id} className="chip chip-plain">
                            {monitor.name}
                        </span>
                    ))}
                </p>
            ) : null}
        </li>
    );
}

// The day on the left, what happened that day on the right.
export function Timeline({
    incidentsByDate,
}: {
    incidentsByDate: Record<string, Incident[]>;
}) {
    return (
        <ol className="tl">
            {Object.entries(incidentsByDate).map(([date, incidents]) => (
                <li key={date} className="tl-day">
                    <div className="tl-when">
                        <h3 className="tl-date">{date}</h3>
                    </div>
                    <div className="tl-what">
                        {incidents.map((incident) => (
                            <article key={incident.id} className="tl-incident">
                                <h4>
                                    <a href={incident.detailsLink}>
                                        {incident.title}
                                    </a>
                                </h4>
                                <ImpactChips incident={incident} />
                                <Updates incident={incident} />
                            </article>
                        ))}
                    </div>
                </li>
            ))}
        </ol>
    );
}

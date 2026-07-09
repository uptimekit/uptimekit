import { ImageResponse } from "next/og";
import { privateImageResponse } from "./og-responses";
import { prepareIncidentDetailData } from "./subpage-data-preparer";

function humanize(value: string) {
    return value.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
}

function formatDate(value: Date) {
    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(value);
}

export async function incidentImageResponse(
    pageConfig: any,
    incidentId: string,
    routeSlug?: string,
): Promise<Response> {
    try {
        const { config, incident } = await prepareIncidentDetailData(
            pageConfig,
            incidentId,
            routeSlug,
        );
        const color =
            incident.status === "resolved"
                ? "#22c55e"
                : incident.severity === "critical"
                  ? "#ef4444"
                  : incident.severity === "minor"
                    ? "#eab308"
                    : incident.severity === "maintenance"
                      ? "#3b82f6"
                      : "#f97316";
        const monitors = incident.monitors
            .map((item) => item.monitor?.name)
            .filter(Boolean);
        const affected = monitors.length
            ? `${monitors.slice(0, 3).join(", ")}${monitors.length > 3 ? ` +${monitors.length - 3} more` : ""}`
            : "All services";

        return new ImageResponse(
            <div
                style={{
                    background: "#18181b",
                    color: "white",
                    display: "flex",
                    flexDirection: "column",
                    fontFamily: "Inter, sans-serif",
                    height: "100%",
                    justifyContent: "space-between",
                    padding: "72px",
                    width: "100%",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 24,
                    }}
                >
                    <div
                        style={{
                            alignItems: "center",
                            color: "#d4d4d8",
                            display: "flex",
                            fontSize: 28,
                            gap: 14,
                        }}
                    >
                        <span
                            style={{
                                background: color,
                                borderRadius: "999px",
                                display: "flex",
                                height: 18,
                                width: 18,
                            }}
                        />
                        {config.name} incident
                    </div>
                    <div
                        style={{
                            display: "flex",
                            fontSize: 68,
                            fontWeight: 800,
                            letterSpacing: "-0.04em",
                            lineHeight: 1,
                            maxWidth: 980,
                        }}
                    >
                        {incident.title}
                    </div>
                </div>

                <div style={{ display: "flex", gap: 18 }}>
                    {[
                        ["Status", humanize(incident.status)],
                        ["Severity", humanize(incident.severity)],
                        ["Affected", affected],
                        ["Started", formatDate(incident.startedAt)],
                    ].map(([label, value]) => (
                        <div
                            key={label}
                            style={{
                                background: "#27272a",
                                borderRadius: 24,
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                                padding: "22px 24px",
                                width: label === "Affected" ? 360 : 210,
                            }}
                        >
                            <div style={{ color: "#a1a1aa", fontSize: 22 }}>
                                {label}
                            </div>
                            <div
                                style={{
                                    color:
                                        label === "Severity" ? color : "white",
                                    display: "flex",
                                    fontSize: 28,
                                    fontWeight: 700,
                                    lineHeight: 1.15,
                                }}
                            >
                                {value}
                            </div>
                        </div>
                    ))}
                </div>
            </div>,
            {
                width: 1200,
                height: 630,
                headers: {
                    "Cache-Control": "private, no-store",
                },
            },
        );
    } catch {
        return privateImageResponse();
    }
}

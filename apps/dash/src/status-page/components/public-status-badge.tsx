import { faUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import type { StatusType } from "@/status-page/themes/types";

export type BadgeTheme = "light" | "dark";

type StatusColorKey =
    | "operational"
    | "degraded"
    | "partialOutage"
    | "majorOutage"
    | "maintenance"
    | "unknown";

const badgeStatus = {
    operational: { label: "All systems operational", color: "operational" },
    degraded: {
        label: "Some systems are experiencing issues",
        color: "degraded",
    },
    partial_outage: {
        label: "Some systems are unavailable",
        color: "partialOutage",
    },
    major_outage: { label: "Major system outage", color: "majorOutage" },
    maintenance: { label: "Maintenance in progress", color: "maintenance" },
    maintenance_scheduled: {
        label: "Scheduled maintenance",
        color: "maintenance",
    },
    maintenance_completed: {
        label: "All systems operational",
        color: "operational",
    },
    unknown: { label: "System status unavailable", color: "unknown" },
} satisfies Record<StatusType, { label: string; color: StatusColorKey }>;

const lightStatusColors = {
    operational: "oklch(0.64 0.19 146.42)",
    degraded: "oklch(0.65 0.2 85)",
    partialOutage: "oklch(0.7 0.19 47.56)",
    majorOutage: "oklch(0.57 0.21 27.29)",
    maintenance: "oklch(0.62 0.19 254.67)",
    unknown: "oklch(0.55 0.03 264.37)",
} satisfies Record<StatusColorKey, string>;

// The badge page loads no stylesheet so it can sit transparently inside any
// embedding site; these values mirror the tokens in styles/base.css.
const badgeThemes = {
    light: {
        background: "#ffffff",
        border: "rgb(0 0 0 / 0.08)",
        text: "#262626",
        icon: "#686868",
        shadow: "0 1px 2px rgb(0 0 0 / 0.09)",
        status: lightStatusColors,
    },
    dark: {
        background: "#1b1b1b",
        border: "rgb(255 255 255 / 0.06)",
        text: "#f5f5f5",
        icon: "#818181",
        shadow: "0 1px 2px rgb(0 0 0 / 0.09)",
        status: {
            ...lightStatusColors,
            degraded: "oklch(0.7 0.18 85)",
            unknown: "oklch(0.4 0 0)",
        },
    },
} satisfies Record<BadgeTheme, unknown>;

export function parseBadgeTheme(value: string | string[] | undefined) {
    return value === "dark" ? "dark" : "light";
}

function ExternalLinkIcon() {
    const [width, height, , , path] = faUpRightFromSquare.icon;

    return (
        <svg
            aria-hidden="true"
            viewBox={`0 0 ${width} ${height}`}
            width={12}
            height={12}
            fill="currentColor"
            style={{ display: "block", flex: "0 0 auto" }}
        >
            <path d={Array.isArray(path) ? path.join(" ") : path} />
        </svg>
    );
}

export function PublicStatusBadge({
    href,
    name,
    status,
    theme = "light",
}: {
    href: string;
    name: string;
    status: StatusType;
    theme?: BadgeTheme;
}) {
    const colors = badgeThemes[theme];
    const current = badgeStatus[status] ?? badgeStatus.unknown;
    const statusColor = colors.status[current.color];

    return (
        <a
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={`View ${name} status page: ${current.label}`}
            style={{
                alignItems: "center",
                background: colors.background,
                border: `1px solid ${colors.border}`,
                borderRadius: 9999,
                boxShadow: colors.shadow,
                boxSizing: "border-box",
                color: colors.text,
                display: "inline-flex",
                fontFamily:
                    "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                gap: 8,
                height: 38,
                lineHeight: 1,
                maxWidth: "100%",
                padding: "0 14px",
                textDecoration: "none",
                whiteSpace: "nowrap",
            }}
        >
            <span
                aria-hidden="true"
                style={{
                    background: statusColor,
                    borderRadius: "50%",
                    boxShadow: `0 0 0 4px color-mix(in srgb, ${statusColor} 12%, transparent)`,
                    display: "inline-flex",
                    flex: "0 0 auto",
                    height: 8,
                    width: 8,
                }}
            />
            <span
                style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                {current.label}
            </span>
            <span style={{ color: colors.icon, display: "inline-flex" }}>
                <ExternalLinkIcon />
            </span>
        </a>
    );
}

import { faUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { StatusType } from "@/status-page/themes/types";

const badgeStatus = {
    operational: {
        label: "All systems operational",
        color: "#16a34a",
    },
    degraded: {
        label: "Some systems are experiencing issues",
        color: "#d97706",
    },
    partial_outage: {
        label: "Some systems are unavailable",
        color: "#ea580c",
    },
    major_outage: {
        label: "Major system outage",
        color: "#dc2626",
    },
    maintenance: {
        label: "Maintenance in progress",
        color: "#2563eb",
    },
    maintenance_scheduled: {
        label: "Scheduled maintenance",
        color: "#2563eb",
    },
    maintenance_completed: {
        label: "All systems operational",
        color: "#16a34a",
    },
    unknown: {
        label: "System status unavailable",
        color: "#64748b",
    },
} satisfies Record<StatusType, { label: string; color: string }>;

export type BadgeTheme = "light" | "dark";

const badgeThemes = {
    light: {
        background: "#ffffff",
        border: "#e5e7eb",
        text: "#0f172a",
        icon: "#94a3b8",
        shadow: "0 1px 2px rgb(15 23 42 / 0.06)",
    },
    dark: {
        background: "#0f172a",
        border: "#1e293b",
        text: "#f8fafc",
        icon: "#64748b",
        shadow: "0 1px 2px rgb(0 0 0 / 0.3)",
    },
} satisfies Record<BadgeTheme, Record<string, string>>;

export function parseBadgeTheme(value: string | string[] | undefined) {
    return value === "dark" ? "dark" : "light";
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
                    background: current.color,
                    borderRadius: "50%",
                    boxShadow: `0 0 0 4px ${current.color}1f`,
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
            <span
                aria-hidden="true"
                style={{ color: colors.icon, fontSize: 15, fontWeight: 400 }}
            >
                <FontAwesomeIcon icon={faUpRightFromSquare} />
            </span>
        </a>
    );
}

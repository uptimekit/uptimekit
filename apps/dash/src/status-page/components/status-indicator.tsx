import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cn } from "@/status-page/lib/utils";
import { statusConfig } from "@/status-page/themes/status-config";
import type { StatusType } from "@/status-page/themes/types";

interface StatusIndicatorProps {
    status: StatusType;
    showLabel?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
}

const sizeConfig = {
    sm: { icon: "h-3.5 w-3.5", text: "text-xs" },
    md: { icon: "h-4 w-4", text: "text-sm" },
    lg: { icon: "h-5 w-5", text: "text-base" },
};

export function StatusIndicator({
    status,
    showLabel = true,
    size = "md",
    className,
}: StatusIndicatorProps) {
    const config = statusConfig[status];
    const sizes = sizeConfig[size];

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <FontAwesomeIcon
                icon={config.icon}
                className={cn(sizes.icon, config.color, "animate-pulse-glow")}
            />
            {showLabel ? (
                <span className={cn("font-medium", sizes.text, config.color)}>
                    {config.label}
                </span>
            ) : null}
        </div>
    );
}

export function StatusDot({
    status,
    className,
}: {
    status: StatusType;
    className?: string;
}) {
    const config = statusConfig[status];

    return (
        <span className={cn("relative block h-2.5 w-2.5", className)}>
            <span
                className={cn("block h-2.5 w-2.5 rounded-full", config.bgColor)}
            />
            {status === "operational" ? (
                <span
                    className={cn(
                        "absolute inset-0 block animate-ping rounded-full opacity-50",
                        config.bgColor,
                    )}
                />
            ) : null}
        </span>
    );
}

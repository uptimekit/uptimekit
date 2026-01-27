import { cn } from "@/lib/utils";
import { statusConfig } from "../../status-config";
import type { StatusType } from "../../types";

interface StatusIndicatorProps {
    status: StatusType;
    showLabel?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
}

const sizeConfig = {
    sm: { dot: "h-2 w-2", icon: "h-3.5 w-3.5", text: "text-xs" },
    md: { dot: "h-2.5 w-2.5", icon: "h-4 w-4", text: "text-sm" },
    lg: { dot: "h-3 w-3", icon: "h-5 w-5", text: "text-base" },
};

export function StatusIndicator({
    status,
    showLabel = true,
    size = "md",
    className,
}: StatusIndicatorProps) {
    const config = statusConfig[status];
    const sizes = sizeConfig[size];
    const Icon = config.icon;

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <div
                className={cn(
                    "relative flex items-center justify-center",
                    config.color,
                )}
            >
                <Icon className={cn(sizes.icon, "animate-pulse-glow")} />
            </div>
            {showLabel && (
                <span className={cn("font-medium", sizes.text, config.color)}>
                    {config.label}
                </span>
            )}
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
        <div className={cn("relative", className)}>
            <div
                className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    config.bgColor,
                    status === "operational" && "animate-pulse",
                )}
            />
            {status === "operational" && (
                <div
                    className={cn(
                        "absolute inset-0 h-2.5 w-2.5 animate-ping rounded-full opacity-75",
                        config.bgColor,
                    )}
                />
            )}
        </div>
    );
}

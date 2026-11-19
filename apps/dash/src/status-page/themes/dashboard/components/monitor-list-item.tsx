import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type React from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/status-page/components/ui/tooltip";
import { cn } from "@/status-page/lib/utils";
import { statusConfig } from "../../status-config";
import type { StatusType, UptimeDay } from "../../types";
import { StatusDot } from "./status-indicator";
import { UptimeBar } from "./uptime-bar";

interface MonitorListItemProps {
    name: string;
    status: StatusType;
    uptimePercentage: number;
    history: UptimeDay[];
    displayStyle?: "history" | "status";
    className?: string;
    description?: string | null;
    toFixed?: number;
    barStyle?: "normal" | "length" | "signal";
    variant?: "list" | "card";
}

export function MonitorListItem({
    name,
    status,
    uptimePercentage,
    history,
    displayStyle = "history",
    className,
    description,
    toFixed = 2,
    barStyle = "normal",
    variant = "list",
}: MonitorListItemProps): React.JSX.Element {
    const isCard = variant === "card";

    if (displayStyle === "status") {
        return (
            <div
                className={cn(
                    "group transition-colors",
                    isCard
                        ? "h-full rounded-lg border border-border bg-card p-4 shadow-2xs"
                        : "py-3.5 first:pt-0 last:pb-0",
                    className,
                )}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <StatusDot status={status} />
                        <h4 className="truncate font-medium text-foreground text-sm">
                            {name}
                        </h4>
                        {description && (
                            <Tooltip>
                                <TooltipTrigger
                                    render={
                                        <button
                                            type="button"
                                            className="rounded-full outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            aria-label="More information"
                                        />
                                    }
                                >
                                    <FontAwesomeIcon
                                        icon={faCircleInfo}
                                        className="h-3.5 w-3.5 text-muted-foreground/60 transition-colors hover:text-foreground"
                                    />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="max-w-xs text-xs">
                                        {description}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                    <div
                        className={cn(
                            "shrink-0 font-medium text-xs",
                            statusConfig[status]?.color ||
                                "text-muted-foreground",
                        )}
                    >
                        {statusConfig[status]?.label || status || "Unknown"}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "group transition-colors",
                isCard
                    ? "h-full rounded-lg border border-border bg-card p-4 shadow-2xs"
                    : "py-4 first:pt-0 last:pb-0",
                className,
            )}
        >
            <div className="mb-2.5 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                    <StatusDot status={status} />
                    <h4 className="truncate font-medium text-foreground text-sm">
                        {name}
                    </h4>
                    {description && (
                        <Tooltip>
                            <TooltipTrigger
                                render={
                                    <button
                                        type="button"
                                        className="rounded-full outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        aria-label="More information"
                                    />
                                }
                            >
                                <FontAwesomeIcon
                                    icon={faCircleInfo}
                                    className="h-3.5 w-3.5 text-muted-foreground/60 transition-colors hover:text-foreground"
                                />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="max-w-xs text-xs">
                                    {description}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
                <div
                    className={cn(
                        "shrink-0 font-medium text-xs",
                        statusConfig[status]?.color || "text-muted-foreground",
                    )}
                >
                    {uptimePercentage.toFixed(toFixed)}% uptime
                </div>
            </div>

            <UptimeBar days={history} style={barStyle} toFixed={toFixed} />
        </div>
    );
}

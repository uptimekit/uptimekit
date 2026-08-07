import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
}: MonitorListItemProps) {
    const isCard = variant === "card";

    // Status-only mode: show only name and current status
    if (displayStyle === "status") {
        return (
            <div
                className={cn(
                    "group",
                    isCard ? "h-full" : "py-4 first:pt-0 last:pb-0",
                    className,
                )}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <StatusDot status={status} />
                        <h3 className="font-semibold text-foreground text-lg">
                            {name}
                        </h3>
                        {description && (
                            <Tooltip>
                                <TooltipTrigger
                                    render={
                                        <FontAwesomeIcon
                                            icon={faCircleInfo}
                                            className="h-4 w-4 text-muted-foreground/60"
                                        />
                                    }
                                />
                                <TooltipContent>
                                    <p className="max-w-xs text-sm">
                                        {description}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                    <div
                        className={cn(
                            "font-medium text-sm",
                            statusConfig[status].color,
                        )}
                    >
                        {statusConfig[status].label}
                    </div>
                </div>
            </div>
        );
    }

    // History mode: show full uptime bar with history
    return (
        <div
            className={cn(
                "group",
                isCard ? "h-full" : "py-6 first:pt-0 last:pb-0",
                className,
            )}
        >
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <StatusDot status={status} />
                    <h3 className="font-semibold text-foreground text-lg">
                        {name}
                    </h3>
                    {description && (
                        <Tooltip>
                            <TooltipTrigger
                                render={
                                    <FontAwesomeIcon
                                        icon={faCircleInfo}
                                        className="h-4 w-4 text-muted-foreground/60"
                                    />
                                }
                            />
                            <TooltipContent>
                                <p className="max-w-xs text-sm">
                                    {description}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
                <div
                    className={cn(
                        "font-medium text-sm",
                        statusConfig[status].color,
                    )}
                >
                    {uptimePercentage.toFixed(toFixed)}% uptime
                </div>
            </div>

            <UptimeBar days={history} style={barStyle} toFixed={toFixed} />
        </div>
    );
}

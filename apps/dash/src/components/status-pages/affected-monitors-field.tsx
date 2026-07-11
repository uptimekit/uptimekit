import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { GroupedMonitorCombobox } from "@/components/monitors/grouped-monitor-combobox";
import { Button } from "@/components/ui/button";
import { FormControl, FormItem, FormMessage } from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MONITOR_STATUSES = [
    { label: "Degraded", value: "degraded", color: "text-yellow-500" },
    { label: "Downtime", value: "down", color: "text-red-500" },
    { label: "Resolved", value: "resolved", color: "text-green-500" },
    { label: "Not affected", value: "up", color: "text-gray-500" },
] as const;

interface AffectedMonitorsFieldProps {
    monitors: Array<{ id: string; name: string }>;
    selectedMonitors: Array<{ id: string; name: string }>;
    values: Array<{ id: string; status: string }>;
    placeholder: string;
    emptyMessage: string;
    compact?: boolean;
    onSelectionChange: (monitors: Array<{ id: string; name: string }>) => void;
    onStatusChange: (index: number, status: string) => void;
    onRemove: (id: string) => void;
}

export function AffectedMonitorsField({
    monitors,
    selectedMonitors,
    values,
    placeholder,
    emptyMessage,
    compact = false,
    onSelectionChange,
    onStatusChange,
    onRemove,
}: AffectedMonitorsFieldProps) {
    return (
        <>
            <FormItem>
                <FormControl>
                    <GroupedMonitorCombobox
                        ariaLabel="Select monitors"
                        inputClassName="h-8 border-dashed"
                        monitors={monitors}
                        value={selectedMonitors}
                        onValueChange={onSelectionChange}
                        placeholder={placeholder}
                    />
                </FormControl>
                <FormMessage />
            </FormItem>
            {values.length === 0 ? (
                <div
                    className={cn(
                        "text-muted-foreground text-sm",
                        compact
                            ? "italic"
                            : "rounded-lg border bg-card/50 p-8 text-center",
                    )}
                >
                    {emptyMessage}
                </div>
            ) : (
                <div
                    className={cn(
                        "divide-y rounded-md border",
                        !compact && "bg-card/50",
                    )}
                >
                    {values.map((selectedMonitor, index) => {
                        const monitor = monitors.find(
                            (item) => item.id === selectedMonitor.id,
                        );
                        if (!monitor) return null;

                        const status = selectedMonitor.status || "degraded";
                        return (
                            <div
                                key={monitor.id}
                                className={cn(
                                    "flex items-center justify-between",
                                    compact ? "p-3" : "p-4",
                                )}
                            >
                                <div className="font-medium text-sm">
                                    {monitor.name}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Select
                                        value={status}
                                        onValueChange={(value) =>
                                            onStatusChange(
                                                index,
                                                value || "degraded",
                                            )
                                        }
                                    >
                                        <SelectTrigger
                                            className={cn(
                                                "text-xs",
                                                compact
                                                    ? "h-7 w-[130px]"
                                                    : "h-8 w-[140px]",
                                            )}
                                        >
                                            <SelectValue>
                                                {
                                                    MONITOR_STATUSES.find(
                                                        (option) =>
                                                            option.value ===
                                                            status,
                                                    )?.label
                                                }
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {MONITOR_STATUSES.map((option) => (
                                                <SelectItem
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className={`h-2 w-2 rounded-full bg-current ${option.color.replace("text-", "bg-")}`}
                                                        />
                                                        {option.label}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className={cn(
                                            "text-muted-foreground hover:text-foreground",
                                            compact ? "h-7 w-7" : "h-8 w-8",
                                        )}
                                        onClick={() =>
                                            onRemove(selectedMonitor.id)
                                        }
                                    >
                                        <FontAwesomeIcon
                                            icon={faXmark}
                                            className={
                                                compact
                                                    ? "h-3.5 w-3.5"
                                                    : "h-4 w-4"
                                            }
                                        />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}

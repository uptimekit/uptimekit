"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

type NtfyPriority = "min" | "low" | "default" | "high" | "max";

interface NtfyConfigValues {
    serverUrl?: string;
    topic?: string;
    accessToken?: string;
    priority?: NtfyPriority;
    tags?: string;
}

interface NtfyConfigProps {
    config: NtfyConfigValues;
    onChange: (config: NtfyConfigValues) => void;
}

const priorityOptions = [
    { label: "Minimum", value: "min" },
    { label: "Low", value: "low" },
    { label: "Default", value: "default" },
    { label: "High", value: "high" },
    { label: "Maximum", value: "max" },
] as const;

export function NtfyConfig({ config, onChange }: NtfyConfigProps) {
    const priority = config.priority || "default";
    const selectedPriority =
        priorityOptions.find((option) => option.value === priority) ||
        priorityOptions[2];

    const setConfigValue = (
        key: keyof NtfyConfigValues,
        value: NtfyConfigValues[keyof NtfyConfigValues],
    ) => {
        onChange({ ...config, [key]: value });
    };

    return (
        <div className="grid gap-4">
            <div className="grid gap-1.5">
                <Label htmlFor="ntfy-server-url">Server URL</Label>
                <Input
                    id="ntfy-server-url"
                    type="url"
                    value={config.serverUrl ?? "https://ntfy.sh"}
                    onChange={(event) =>
                        setConfigValue("serverUrl", event.target.value)
                    }
                    placeholder="https://ntfy.sh"
                />
                <p className="text-muted-foreground text-xs">
                    Use https://ntfy.sh or the public URL of your self-hosted
                    server.
                </p>
            </div>

            <div className="grid gap-1.5">
                <Label htmlFor="ntfy-topic">Topic</Label>
                <Input
                    id="ntfy-topic"
                    value={config.topic || ""}
                    onChange={(event) =>
                        setConfigValue("topic", event.target.value)
                    }
                    placeholder="uptimekit-alerts"
                    maxLength={64}
                />
                <p className="text-muted-foreground text-xs">
                    Treat an unprotected topic name like a password and make it
                    difficult to guess.
                </p>
            </div>

            <div className="grid gap-1.5">
                <Label htmlFor="ntfy-access-token">Access token</Label>
                <Input
                    id="ntfy-access-token"
                    type="password"
                    value={config.accessToken || ""}
                    onChange={(event) =>
                        setConfigValue("accessToken", event.target.value)
                    }
                    placeholder="Optional Bearer token"
                />
            </div>

            <div className="grid gap-1.5">
                <Label htmlFor="ntfy-priority">Priority</Label>
                <Select
                    value={priority}
                    onValueChange={(value: NtfyPriority | null) =>
                        setConfigValue("priority", value || "default")
                    }
                >
                    <SelectTrigger id="ntfy-priority">
                        <SelectValue placeholder="Select priority">
                            {selectedPriority.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {priorityOptions.map(({ label, value }) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-1.5">
                <Label htmlFor="ntfy-tags">Tags</Label>
                <Input
                    id="ntfy-tags"
                    value={config.tags || ""}
                    onChange={(event) =>
                        setConfigValue("tags", event.target.value)
                    }
                    placeholder="warning, uptimekit"
                />
                <p className="text-muted-foreground text-xs">
                    Optional comma-separated ntfy tags or emoji shortcodes.
                </p>
            </div>
        </div>
    );
}

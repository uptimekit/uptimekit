import type { ComponentProps } from "react";
import { IncidentCard as SharedIncidentCard } from "@/status-page/components/incident-card";
import { cn } from "@/status-page/lib/utils";

type FlatIncidentCardProps = ComponentProps<typeof SharedIncidentCard>;

export function IncidentCard({ className, ...props }: FlatIncidentCardProps) {
    return (
        <SharedIncidentCard
            {...props}
            className={cn(
                "bg-card transition-colors hover:bg-muted/70",
                className,
            )}
        />
    );
}

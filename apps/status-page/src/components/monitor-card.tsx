import { cn } from "@/lib/utils";
import { StatusDot, type StatusType } from "./status-indicator";
import { UptimeBar, generateMockUptimeData } from "./uptime-bar";
import { ExternalLink } from "lucide-react";

interface MonitorCardProps {
	name: string;
	status: StatusType;
	uptime: number;
	responseTime?: number;
	url?: string;
	className?: string;
}

export function MonitorCard({
	name,
	status,
	uptime,
	responseTime,
	url,
	className,
}: MonitorCardProps) {
	const uptimeData = generateMockUptimeData(90);

	return (
		<div
			className={cn(
				"group rounded-xl border border-border bg-card p-5 transition-all duration-300",
				"hover:shadow-lg hover:border-primary/20 hover:-translate-y-0.5",
				className
			)}
		>
			<div className="flex items-start justify-between mb-4">
				<div className="flex items-center gap-3">
					<StatusDot status={status} />
					<div>
						<h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors">
							{name}
						</h3>
						{url && (
							<a
								href={url}
								target="_blank"
								rel="noopener noreferrer"
								className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
							>
								{new URL(url).hostname}
								<ExternalLink className="h-3 w-3" />
							</a>
						)}
					</div>
				</div>
				<div className="text-right">
					<div className="text-sm font-medium text-card-foreground">
						{uptime.toFixed(2)}%
					</div>
					{responseTime && (
						<div className="text-xs text-muted-foreground">
							{responseTime}ms
						</div>
					)}
				</div>
			</div>

			<UptimeBar days={uptimeData} />
		</div>
	);
}

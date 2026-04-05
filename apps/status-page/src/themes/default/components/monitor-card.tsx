import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatusType, UptimeDay } from "../../types";
import { StatusDot } from "./status-indicator";
import { generateMockUptimeData, UptimeBar } from "./uptime-bar";

interface MonitorCardProps {
	name: string;
	status: StatusType;
	uptime: number;
	responseTime?: number;
	url?: string;
	className?: string;
	uptimeHistory?: UptimeDay[];
}

export function MonitorCard({
	name,
	status,
	uptime,
	responseTime,
	url,
	className,
	uptimeHistory,
}: MonitorCardProps) {
	const uptimeData = uptimeHistory || generateMockUptimeData(90);

	return (
		<div
			className={cn(
				"group rounded-xl border border-border bg-card p-5 transition-all duration-300",
				"hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg",
				className,
			)}
		>
			<div className="mb-4 flex items-start justify-between">
				<div className="flex items-center gap-3">
					<StatusDot status={status} />
					<div>
						<h3 className="font-semibold text-card-foreground transition-colors group-hover:text-primary">
							{name}
						</h3>
						{url && (
							<a
								href={url}
								target="_blank"
								rel="noopener noreferrer"
								className="mt-0.5 flex items-center gap-1 text-muted-foreground text-xs hover:text-primary"
							>
								{(() => {
									try {
										return new URL(url).hostname;
									} catch {
										return url;
									}
								})()}
								<ExternalLink className="h-3 w-3" />
							</a>
						)}
					</div>
				</div>
				<div className="text-right">
					<div className="font-medium text-card-foreground text-sm">
						{uptime.toFixed(2)}%
					</div>
					{responseTime && (
						<div className="text-muted-foreground text-xs">
							{responseTime}ms
						</div>
					)}
				</div>
			</div>

			<UptimeBar days={uptimeData} />
		</div>
	);
}

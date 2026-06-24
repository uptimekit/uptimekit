import { faUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cn } from "@/lib/utils";
import type { StatusType, UptimeDay } from "../../types";
import { StatusDot } from "./status-indicator";
import { UptimeBar } from "./uptime-bar";

interface MonitorCardProps {
	name: string;
	status: StatusType;
	uptime: number;
	responseTime?: number;
	url?: string;
	toFixed?: number;
	className?: string;
	uptimeHistory?: UptimeDay[];
}

export function MonitorCard({
	name,
	status,
	uptime,
	responseTime,
	url,
	toFixed = 2,
	className,
	uptimeHistory,
}: MonitorCardProps) {
	const uptimeData = uptimeHistory ?? [];
	const hasUptimeHistory = uptimeData.length > 0;

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
								<FontAwesomeIcon
									icon={faUpRightFromSquare}
									className="h-3 w-3"
								/>
							</a>
						)}
					</div>
				</div>
				<div className="text-right">
					<div className="font-medium text-card-foreground text-sm">
						{uptime.toFixed(toFixed)}%
					</div>
					{responseTime && (
						<div className="text-muted-foreground text-xs">
							{responseTime}ms
						</div>
					)}
				</div>
			</div>

			{hasUptimeHistory ? (
				<UptimeBar days={uptimeData} toFixed={toFixed} />
			) : (
				<div className="rounded-lg border border-border/80 border-dashed bg-muted/30 px-3 py-4 text-center text-muted-foreground text-sm">
					Uptime history unavailable
				</div>
			)}
		</div>
	);
}

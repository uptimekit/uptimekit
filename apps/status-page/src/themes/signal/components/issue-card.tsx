import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Incident } from "../../types";
import { StatusBadge, StatusDot } from "./status-indicator";
import { formatDateTime, formatShortDate, getIssueStatus } from "./utils";

interface IssueCardProps {
	incident: Incident;
	isExpanded?: boolean;
	onToggle?: () => void;
	detailsLink?: string;
	className?: string;
}

export function IssueCard({
	incident,
	isExpanded = false,
	onToggle,
	detailsLink,
	className,
}: IssueCardProps) {
	const status = getIssueStatus(incident);

	return (
		<div
			className={cn(
				"signal-panel overflow-hidden rounded-2xl border border-border",
				className,
			)}
		>
			<div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5">
				<div className="min-w-0 flex-1">
					<div className="mb-2 flex items-start gap-3">
						<StatusDot status={status} className="mt-1 shrink-0" />
						<div className="min-w-0">
							<h3 className="font-medium text-[15px] leading-6 text-foreground sm:text-[16px]">
								{incident.title}
							</h3>
							<p className="mt-1 text-[12px] text-muted-foreground">
								{formatShortDate(incident.startedAt)}
								{incident.endedAt ? " • Resolved" : ""}
							</p>
						</div>
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-2">
					<StatusBadge status={status} className="hidden sm:inline-flex" />
					{detailsLink ? (
						<Link
							href={detailsLink as any}
							className="signal-button inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-transform duration-150 hover:-translate-y-px hover:text-foreground"
						>
							<ChevronDown className="h-4 w-4 -rotate-90" />
						</Link>
					) : (
						<button
							type="button"
							onClick={onToggle}
							className="signal-button inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-transform duration-150 hover:-translate-y-px hover:text-foreground"
						>
							{isExpanded ? (
								<ChevronUp className="h-4 w-4" />
							) : (
								<ChevronDown className="h-4 w-4" />
							)}
						</button>
					)}
				</div>
			</div>

			{isExpanded && !detailsLink ? (
				<div className="border-border/80 border-t px-4 py-4 sm:px-5 sm:py-5">
					{incident.monitors.length > 0 ? (
						<div className="mb-5 space-y-3">
							<div className="text-[11px] font-medium uppercase text-muted-foreground">
								Affected services
							</div>
							<div className="flex flex-wrap gap-2">
								{incident.monitors.map((item) => (
									<span
										key={item.monitor.id}
										className="rounded-full border border-border bg-muted px-3 py-1 text-[12px] text-foreground"
									>
										{item.monitor.name}
									</span>
								))}
							</div>
						</div>
					) : null}

					{incident.activities.length > 0 ? (
						<div className="space-y-4">
							<div className="text-[11px] font-medium uppercase text-muted-foreground">
								Timeline
							</div>
							<div className="space-y-4">
								{incident.activities.map((activity, index) => (
									<div key={activity.id} className="relative pl-6">
										{index !== incident.activities.length - 1 ? (
											<div className="absolute left-[7px] top-4 h-[calc(100%+0.75rem)] w-px bg-border" />
										) : null}
										<div className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border border-background bg-muted-foreground/35" />
										<div className="space-y-1">
											<div className="text-[12px] text-muted-foreground">
												{formatDateTime(activity.createdAt)} UTC
											</div>
											<p className="text-[14px] leading-6 text-foreground">
												{activity.message}
											</p>
										</div>
									</div>
								))}
							</div>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}

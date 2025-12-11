import { cn } from "@/lib/utils";
import { StatusIndicator, type StatusType } from "./status-indicator";

interface OverallStatusProps {
	status: StatusType;
	className?: string;
}

const statusMessages: Record<
	StatusType,
	{ title: string; description: string }
> = {
	operational: {
		title: "All Systems Operational",
		description: "All services are running smoothly with no reported issues.",
	},
	degraded: {
		title: "Degraded Performance",
		description:
			"Some services are experiencing slower than usual response times.",
	},
	partial_outage: {
		title: "Partial System Outage",
		description:
			"Some services are currently unavailable. We are investigating.",
	},
	major_outage: {
		title: "Major System Outage",
		description:
			"Multiple services are experiencing issues. Our team is working on it.",
	},
	maintenance: {
		title: "Scheduled Maintenance",
		description:
			"System is undergoing planned maintenance. Services may be temporarily unavailable.",
	},
	unknown: {
		title: "Status Unknown",
		description: "We are currently unable to determine the system status.",
	},
};

const statusGradients: Record<StatusType, string> = {
	operational:
		"from-status-operational/10 via-status-operational/5 to-transparent",
	degraded: "from-status-degraded/10 via-status-degraded/5 to-transparent",
	partial_outage:
		"from-status-partial-outage/10 via-status-partial-outage/5 to-transparent",
	major_outage:
		"from-status-major-outage/10 via-status-major-outage/5 to-transparent",
	maintenance:
		"from-status-maintenance/10 via-status-maintenance/5 to-transparent",
	unknown: "from-status-unknown/10 via-status-unknown/5 to-transparent",
};

export function OverallStatus({ status, className }: OverallStatusProps) {
	const message = statusMessages[status];

	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-2xl border border-border bg-card p-8 text-center",
				className,
			)}
		>
			{/* Gradient background */}
			<div
				className={cn(
					"absolute inset-0 bg-gradient-to-b",
					statusGradients[status],
				)}
			/>

			{/* Content */}
			<div className="relative z-10">
				<div className="mb-4 flex justify-center">
					<StatusIndicator status={status} size="lg" showLabel={false} />
				</div>
				<h1 className="mb-2 animate-slide-up font-bold text-2xl text-card-foreground md:text-3xl">
					{message.title}
				</h1>
				<p
					className="mx-auto max-w-md animate-slide-up text-muted-foreground"
					style={{ animationDelay: "0.1s" }}
				>
					{message.description}
				</p>

				{/* Last updated */}
				<div className="mt-6 border-border border-t pt-6">
					<p className="text-muted-foreground text-xs">
						Last updated:{" "}
						<time className="font-medium">
							{new Date().toLocaleString("en-US", {
								dateStyle: "medium",
								timeStyle: "short",
							})}
						</time>
					</p>
				</div>
			</div>
		</div>
	);
}

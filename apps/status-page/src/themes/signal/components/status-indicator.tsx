import { cn } from "@/lib/utils";
import { statusConfig } from "../../status-config";
import type { StatusType } from "../../types";

export function StatusBadge({
	status,
	className,
}: {
	status: StatusType;
	className?: string;
}) {
	const config = statusConfig[status];

	return (
		<div className={cn("inline-flex items-center gap-2", className)}>
			<span className={cn("h-2.5 w-2.5 rounded-full", config.bgColor)} />
			<span className={cn("font-medium text-sm", config.color)}>
				{config.label}
			</span>
		</div>
	);
}

export function StatusDot({
	status,
	className,
}: {
	status: StatusType;
	className?: string;
}) {
	const config = statusConfig[status];

	return (
		<div className={cn("relative h-2.5 w-2.5", className)}>
			<div className={cn("h-2.5 w-2.5 rounded-full", config.bgColor)} />
			{status === "operational" && (
				<div
					className={cn(
						"absolute inset-0 animate-ping rounded-full opacity-35",
						config.bgColor,
					)}
				/>
			)}
		</div>
	);
}

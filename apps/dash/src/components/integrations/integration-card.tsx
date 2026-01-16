import type { IntegrationDefinition } from "@uptimekit/api/pkg/integrations/registry";
import { Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface IntegrationCardProps {
	integration: IntegrationDefinition;
	configured: boolean;
	active?: boolean;
	icon: React.ReactNode;
	category: string;
	onConfigure: () => void;
}

export function IntegrationCard({
	integration,
	configured,
	active,
	icon,
	category,
	onConfigure,
}: IntegrationCardProps) {
	return (
		<Card className="flex w-full flex-row items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/50">
			<div className="flex min-w-0 items-center gap-3 sm:gap-4">
				<div className="shrink-0">{icon}</div>
				<div className="min-w-0 space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="font-semibold text-sm leading-none">
							{integration.name}
						</h3>
						<span className="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-semibold text-muted-foreground text-xs">
							{category}
						</span>
					</div>
					<p className="line-clamp-2 text-muted-foreground text-sm">
						{integration.description}
					</p>
				</div>
			</div>
			<div className="flex shrink-0 items-center gap-2">
				{configured ? (
					<Button
						variant="outline"
						size="sm"
						onClick={onConfigure}
						className={cn(
							active
								? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
								: "",
						)}
					>
						{active ? "Active" : "Inactive"}
						<Settings2 className="ml-2 h-3.5 w-3.5" />
					</Button>
				) : (
					<Button variant="default" size="sm" onClick={onConfigure}>
						Add
						<Plus className="ml-2 h-3.5 w-3.5" />
					</Button>
				)}
			</div>
		</Card>
	);
}

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
		<Card className="flex w-full flex-row items-center justify-between p-4 transition-colors hover:bg-muted/50">
			<div className="flex items-center gap-4">
				{icon}
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<h3 className="font-semibold text-sm leading-none">
							{integration.name}
						</h3>
						<span className="inline-flex items-center rounded-full border px-2 py-0.5 font-semibold text-muted-foreground text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
							{category}
						</span>
					</div>
					<p className="text-muted-foreground text-sm">
						{integration.description}
					</p>
				</div>
			</div>
			<div className="flex items-center gap-2">
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

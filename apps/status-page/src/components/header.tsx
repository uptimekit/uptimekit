import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

interface HeaderProps {
	title?: string;
	logoUrl?: string;
	className?: string;
}

export function Header({
	title = "System Status",
	logoUrl,
	className,
}: HeaderProps) {
	return (
		<header className={cn("relative", className)}>
			{/* Decorative gradient */}
			<div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />

			<div className="relative mx-auto max-w-4xl px-4 py-8">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						{logoUrl ? (
							<img src={logoUrl} alt={title} className="h-8 w-auto" />
						) : (
							<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
								<Activity className="h-5 w-5" />
							</div>
						)}
						<h1 className="font-bold text-foreground text-xl">{title}</h1>
					</div>
					<ThemeToggle />
				</div>
			</div>
		</header>
	);
}

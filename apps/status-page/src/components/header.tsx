import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

interface HeaderProps {
	title?: string;
	logoUrl?: string;
	className?: string;
}

export function Header({ 
	title = "System Status", 
	logoUrl,
	className 
}: HeaderProps) {
	return (
		<header className={cn("relative", className)}>
			{/* Decorative gradient */}
			<div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

			<div className="relative max-w-4xl mx-auto px-4 py-8">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						{logoUrl ? (
							<img 
								src={logoUrl} 
								alt={title} 
								className="h-8 w-auto" 
							/>
						) : (
							<div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
								<Activity className="h-5 w-5" />
							</div>
						)}
						<h1 className="text-xl font-bold text-foreground">
							{title}
						</h1>
					</div>
					<ThemeToggle />
				</div>
			</div>
		</header>
	);
}

import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";

interface FooterProps {
	companyName?: string;
	companyUrl?: string;
	className?: string;
}

export function Footer({ 
	companyName = "UptimeKit",
	companyUrl = "#",
	className 
}: FooterProps) {
	return (
		<footer className={cn("border-t border-border bg-card/50", className)}>
			<div className="max-w-4xl mx-auto px-4 py-8">
				<div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
					<p className="flex items-center gap-1">
						Powered by{" "}
						<a 
							href={companyUrl}
							className="font-medium text-foreground hover:text-primary transition-colors"
						>
							{companyName}
						</a>
					</p>
					<p className="flex items-center gap-1">
						Made with <Heart className="h-3.5 w-3.5 text-status-major-outage fill-current" /> for reliability
					</p>
				</div>
			</div>
		</footer>
	);
}

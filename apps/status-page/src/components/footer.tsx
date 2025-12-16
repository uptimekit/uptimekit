import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface FooterProps {
	companyName?: string;
	companyUrl?: string;
	className?: string;
}

export function Footer({
	companyName = "UptimeKit",
	companyUrl = "https://github.com/stripsior/uptimekit",
	className,
}: FooterProps) {
	return (
		<footer className={cn("border-border border-t bg-card/50", className)}>
			<div className="mx-auto max-w-4xl px-4 py-8">
				<div className="flex flex-col items-center justify-between gap-4 text-muted-foreground text-sm sm:flex-row">
					<p className="flex items-center gap-1">
						Powered by{" "}
						<a
							href={companyUrl}
							className="font-medium text-foreground transition-colors hover:text-primary"
						>
							{companyName}
						</a>
					</p>
					<p className="flex items-center gap-1">
						Made with{" "}
						<Heart className="h-3.5 w-3.5 fill-current text-status-major-outage" />{" "}
						for reliability
					</p>
				</div>
			</div>
		</footer>
	);
}

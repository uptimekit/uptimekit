import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface FooterProps {
	companyName?: string;
	companyUrl?: string;
	className?: string;
}

export function Footer({
	companyName = "UptimeKit",
	companyUrl = "https://github.com/uptimekit/uptimekit",
	className,
}: FooterProps) {
	const currentYear = new Date().getFullYear();

	return (
		<footer
			className={cn(
				"w-full border-border/40 border-t bg-background py-5 text-[12px]",
				className,
			)}
		>
			<div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6">
				<div className="flex items-center gap-1.5">
					<span>&copy; {currentYear}</span>
					<a
						href={companyUrl}
						className="font-medium transition-colors hover:text-foreground"
					>
						{companyName}
					</a>
				</div>

				<div className="flex items-center gap-1.5 opacity-70 transition-opacity hover:opacity-100">
					<span>Made with</span>
					<Heart
						aria-hidden="true"
						focusable="false"
						className="h-3 w-3 fill-current text-red-500/70"
					/>
					<span className="hidden sm:inline">for global reliability</span>
				</div>

				<div className="hidden items-center gap-1 opacity-60 transition-opacity hover:opacity-100 md:flex">
					<span>Theme by</span>
					<a
						href="https://mscode.pl?ref=uptimekit-theme"
						target="_blank"
						rel="noopener noreferrer"
						className="font-medium transition-colors hover:text-foreground"
					>
						MsCode
					</a>
				</div>
			</div>
		</footer>
	);
}

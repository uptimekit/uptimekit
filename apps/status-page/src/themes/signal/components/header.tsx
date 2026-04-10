"use client";

import Link from "next/link";
import { buildPath } from "@/lib/route-utils";

interface HeaderProps {
	title?: string;
	logoUrl?: string;
	contactUrl?: string;
	websiteUrl?: string;
	slug: string;
}

export function Header({
	title = "System Status",
	logoUrl,
	contactUrl,
	websiteUrl,
	slug,
}: HeaderProps) {
	const homeHref = buildPath("/", slug);
	const isMailto = contactUrl?.startsWith("mailto:");

	return (
		<header className="sticky top-0 z-20 border-transparent border-b bg-background/92 backdrop-blur-sm">
			<div className="mx-auto flex w-full max-w-[822px] flex-col gap-5 px-4 pt-6 pb-4">
				<div className="flex min-h-9 items-center justify-between gap-4">
					<div className="min-w-0">
						{websiteUrl ? (
							<a
								href={websiteUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="flex min-w-0 items-center gap-3"
							>
								<Brand title={title} logoUrl={logoUrl} />
							</a>
						) : (
							<Link
								href={homeHref as any}
								className="flex min-w-0 items-center gap-3"
							>
								<Brand title={title} logoUrl={logoUrl} />
							</Link>
						)}
					</div>

					<div className="flex items-center gap-2 sm:gap-3">
						<Link
							href={buildPath("/updates", slug) as any}
							className="signal-button inline-flex h-8 items-center justify-center rounded-lg px-3 font-medium text-[13px] text-foreground transition-transform duration-150 hover:-translate-y-px"
						>
							History
						</Link>
						<Link
							href={homeHref as any}
							className="signal-button hidden h-8 items-center justify-center rounded-lg px-3 font-medium text-[13px] text-foreground transition-transform duration-150 hover:-translate-y-px sm:inline-flex"
						>
							Status
						</Link>
						{contactUrl && (
							<a
								href={contactUrl}
								target={isMailto ? undefined : "_blank"}
								rel="noopener noreferrer"
								className="signal-button inline-flex h-8 items-center justify-center rounded-lg px-3 font-medium text-[13px] text-foreground transition-transform duration-150 hover:-translate-y-px"
							>
								Get in touch
							</a>
						)}
					</div>
				</div>
				<div className="signal-divider h-px w-full rounded-full" />
			</div>
		</header>
	);
}

function Brand({ title, logoUrl }: { title: string; logoUrl?: string }) {
	return (
		<>
			{logoUrl ? (
				<>
					{/* biome-ignore lint/performance/noImgElement: theme headers render arbitrary remote logos */}
					<img src={logoUrl} alt={title} className="h-8 w-auto rounded-md" />
				</>
			) : (
				<div className="signal-panel flex h-8 w-8 items-center justify-center rounded-md text-sm">
					{title.slice(0, 1).toUpperCase()}
				</div>
			)}
			<div className="min-w-0">
				<div className="truncate font-bold text-[18px] text-foreground leading-none">
					{title}
				</div>
			</div>
		</>
	);
}

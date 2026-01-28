"use client";

import Link from "next/link";
import { buildPath } from "@/lib/route-utils";

interface HeaderProps {
	title?: string;
	logoUrl?: string;
	contactUrl?: string;
	slug: string;
	className?: string;
}

export function Header({
	title = "System Status",
	logoUrl,
	contactUrl,
	slug,
	className,
}: HeaderProps) {
	const isMailto = contactUrl?.startsWith("mailto:");

	return (
		<header className={className}>
			<div className="relative mx-auto max-w-4xl border-b border-border/40 px-4 py-4">
				<div className="flex items-center justify-between gap-8">
					<div className="flex items-center gap-3">
						{logoUrl ? (
							<img src={logoUrl} alt={title} className="h-8 w-auto" />
						) : (
							<h1 className="font-bold text-foreground text-xl">{title}</h1>
						)}
					</div>

					<nav className="hidden items-center gap-0.5 md:flex">
						<Link
							href={buildPath("/", slug) as any}
							className="rounded-lg px-3 py-1.5 font-medium text-sm text-muted-foreground transition-colors hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-700!"
						>
							Status
						</Link>
						<Link
							href={buildPath("/updates", slug) as any}
							className="rounded-lg px-3 py-1.5 font-medium text-sm text-muted-foreground transition-colors hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-700!"
						>
							Updates
						</Link>
					</nav>

					{contactUrl && (
						<a
							href={contactUrl}
							target={isMailto ? undefined : "_blank"}
							rel="noopener noreferrer"
							className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-white px-4 font-medium text-foreground text-sm transition-colors hover:bg-neutral-100 dark:bg-muted dark:hover:bg-neutral-700!"
						>
							Get in touch
						</a>
					)}
				</div>
			</div>
		</header>
	);
}

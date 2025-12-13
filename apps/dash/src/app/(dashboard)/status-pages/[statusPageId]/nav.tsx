"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
	{
		title: "Settings",
		href: "settings",
	},
	{
		title: "Structure",
		href: "structure",
	},
	{
		title: "Status updates",
		href: "status-updates",
	},
	{
		title: "Maintenance",
		href: "maintenance",
	},
	{
		title: "Subscribers",
		href: "subscribers",
	},
	{
		title: "Translations",
		href: "translations",
	},
];

interface StatusPageNavProps extends React.HTMLAttributes<HTMLElement> {
	statusPageId: string;
}

export function StatusPageNav({
	className,
	statusPageId,
	...props
}: StatusPageNavProps) {
	const pathname = usePathname();

	return (
		<nav
			className={cn(
				"flex flex-wrap items-center gap-6 border-b border-border/40 px-1 pt-2",
				className,
			)}
			{...props}
		>
			{items.map((item) => {
				const href = `/status-pages/${statusPageId}/${item.href}`;
				// Simple check if the path starts with the href, but strict equality is better for tabs
				const isActive = pathname?.endsWith(`/${item.href}`);
				return (
					<Link
						key={item.href}
						href={href as any}
						className={cn(
							"relative pb-3 text-sm font-medium transition-colors hover:text-foreground",
							isActive
								? "text-foreground after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-primary"
								: "text-muted-foreground",
						)}
					>
						{item.title}
					</Link>
				);
			})}
		</nav>
	);
}

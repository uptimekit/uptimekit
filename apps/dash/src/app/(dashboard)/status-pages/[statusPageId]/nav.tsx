"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = {
	title: string;
	href: string;
	disabled?: boolean;
};

const items: NavItem[] = [
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
		disabled: true,
	},
	{
		title: "Translations",
		href: "translations",
		disabled: true,
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
				"flex flex-wrap items-center gap-6 border-border/40 border-b px-1 pt-2",
				className,
			)}
			{...props}
		>
			{items.map((item) => {
				const href = `/status-pages/${statusPageId}/${item.href}`;
				const isActive = pathname?.endsWith(`/${item.href}`);
				const isDisabled = item.disabled;

				if (isDisabled) {
					return (
						<span
							key={item.href}
							className="relative cursor-not-allowed pb-3 font-medium text-muted-foreground/50 text-sm"
						>
							{item.title}
						</span>
					);
				}

				return (
					<Link
						key={item.href}
						href={href as any}
						className={cn(
							"relative pb-3 font-medium text-sm transition-colors hover:text-foreground",
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

"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { orpc } from "@/utils/orpc";

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
	const router = useRouter();

	useQuery(orpc.statusPages.get.queryOptions({ input: { id: statusPageId } }));

	const activeTab =
		items.find((item) => pathname?.endsWith(`/${item.href}`))?.href ??
		items[0]?.href;

	return (
		<Tabs value={activeTab} className={className} {...props}>
			<TabsList variant="underline">
				{items.map((item) => (
					<TabsTab
						key={item.href}
						value={item.href}
						disabled={item.disabled}
						onClick={() =>
							router.push(`/status-pages/${statusPageId}/${item.href}`)
						}
					>
						{item.title}
					</TabsTab>
				))}
			</TabsList>
		</Tabs>
	);
}

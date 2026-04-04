"use client";

import {
	BarChart3,
	ChevronLeft,
	Server,
	Settings,
	Shield,
	Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";

// Admin Navigation items
const adminNav = [
	{
		title: "Overview",
		url: "/admin",
		icon: BarChart3,
	},
	{
		title: "Workers",
		url: "/admin/workers",
		icon: Server,
	},
	{
		title: "Users",
		url: "/admin/users",
		icon: Users,
	},
	{
		title: "Organizations",
		url: "/admin/organizations",
		icon: Shield,
	},
	{
		title: "Settings",
		url: "/admin/settings",
		icon: Settings,
	},
] as const;

export function AdminSidebar({
	...props
}: React.ComponentProps<typeof Sidebar>) {
	const pathname = usePathname();

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" render={<Link href="/" />}>
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
								<ChevronLeft className="size-4" />
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-semibold">Back to App</span>
								<span className="truncate text-xs">Exit admin area</span>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Administration</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{adminNav.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton
										isActive={
											item.url === "/admin"
												? pathname === "/admin"
												: pathname.startsWith(item.url)
										}
										tooltip={item.title}
										render={<Link href={item.url} />}
									>
										<item.icon />
										<span>{item.title}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<AdminUserMenu />
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}

function AdminUserMenu() {
	const { data: session, isPending } = authClient.useSession();

	if (isPending) return <Skeleton className="h-12 w-full rounded-lg" />;
	if (!session) return null;

	return (
		<SidebarMenuButton
			size="lg"
			className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
		>
			<Avatar className="h-8 w-8 rounded-lg group-data-[collapsible=icon]:size-6">
				<AvatarImage src={session.user.image || ""} alt={session.user.name} />
				<AvatarFallback className="rounded-lg">
					{session.user.name.slice(0, 2).toUpperCase()}
				</AvatarFallback>
			</Avatar>
			<div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
				<span className="truncate font-semibold text-red-500">Admin Mode</span>
				<span className="truncate text-xs">{session.user.email}</span>
			</div>
		</SidebarMenuButton>
	);
}

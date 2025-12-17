"use client";

import {
	Activity,
	AlertTriangle,
	ChevronDown,
	Grid2X2,
	LayoutDashboard,
	Plus,
	Settings,
	ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { CreateOrganizationDialog } from "@/components/layout/create-organization-dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/utils/orpc";

// import { UserMenu } from "@/components/layout/user-menu"; // Unused as we defined a local component for now to match structure

// Navigation items
const mainNav = [
	{
		title: "Incidents",
		url: "/",
		icon: AlertTriangle,
	},
	{
		title: "Monitors",
		url: "/monitors",
		icon: Activity,
	},
	{
		title: "Status Pages",
		url: "/status-pages",
		icon: LayoutDashboard,
	},
	{
		title: "Integrations",
		url: "/integrations",
		icon: Grid2X2,
	},
];

const configNav = [
	{
		title: "Settings",
		url: "/settings",
		icon: Settings,
	},
	{
		title: "Admin",
		url: "/admin",
		icon: ShieldAlert,
	},
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const pathname = usePathname();
	const router = useRouter(); // Use useRouter from next/navigation
	const [showCreateOrgModal, setShowCreateOrgModal] = React.useState(false);

	const { data: organizations, isPending: isLoadingOrgs } =
		authClient.useListOrganizations();
	const { data: activeOrg } = authClient.useActiveOrganization();
	const { data: session } = authClient.useSession();

	// Use organization info safely
	// Note: Better-auth might return null/undefined while loading
	const currentOrgName = activeOrg?.name || "Select Organization";

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
								>
									<div className="flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg group-data-[collapsible=icon]:size-6">
										<img
											src={
												activeOrg?.logo ||
												"https://r2.uptimekit.dev/logos/uptimekit.svg"
											}
											alt={currentOrgName}
											className="size-full object-cover"
										/>
									</div>
									<div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
										<span className="truncate font-semibold">
											{currentOrgName}
										</span>
										<span className="truncate text-xs">
											{activeOrg?.slug || "Organization"}
										</span>
									</div>
									<ChevronDown className="ml-auto group-data-[collapsible=icon]:hidden" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
								align="start"
								side="bottom"
								sideOffset={4}
							>
								<DropdownMenuLabel className="text-muted-foreground text-xs">
									Organizations
								</DropdownMenuLabel>
								{isLoadingOrgs ? (
									<DropdownMenuItem disabled>Loading...</DropdownMenuItem>
								) : (
									organizations?.map((org) => (
										<DropdownMenuItem
											key={org.id}
											onClick={() => {
												authClient.organization.setActive(
													{
														organizationId: org.id,
													},
													{
														onSuccess: async () => {
															await queryClient.invalidateQueries();
															router.refresh();
															router.push("/");
														},
													},
												);
											}}
											className="gap-2 p-2"
										>
											<div className="flex size-6 items-center justify-center overflow-hidden rounded-sm border">
												<img
													src={
														org.logo ||
														"https://r2.uptimekit.dev/logos/uptimekit.svg"
													}
													alt={org.name}
													className="size-full object-cover"
												/>
											</div>
											{org.name}
											{activeOrg?.id === org.id && (
												<span className="ml-auto text-muted-foreground text-xs">
													Active
												</span>
											)}
										</DropdownMenuItem>
									))
								)}
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="cursor-pointer gap-2 p-2"
									onSelect={() => setShowCreateOrgModal(true)}
								>
									<div className="flex size-6 items-center justify-center rounded-md border bg-background">
										<Plus className="size-4" />
									</div>
									<div className="font-medium text-muted-foreground">
										Add Organization
									</div>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Main</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{mainNav.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton
										asChild
										isActive={
											item.url === "/"
												? pathname === "/"
												: pathname.startsWith(item.url)
										}
										tooltip={item.title}
									>
										<Link href={item.url as any}>
											<item.icon />
											<span>{item.title}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarSeparator />
				<SidebarGroup>
					<SidebarGroupLabel>Configuration</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{configNav
								.filter(
									(item) =>
										item.title !== "Admin" || session?.user?.role === "admin",
								)
								.map((item) => (
									<SidebarMenuItem key={item.title}>
										<SidebarMenuButton
											asChild
											isActive={pathname.startsWith(item.url)}
											tooltip={item.title}
										>
											<Link href={item.url as any}>
												<item.icon />
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				{/* Reusing existing UserMenu but we might need to adapt it if it's strictly a dropdown trigger without structure. 
                    Let's check UserMenu again or just embed the logic here for better sidebar integration. 
                    For now, let's wrap it in a menu item */}
				<SidebarMenu>
					<SidebarMenuItem>
						<UserMenuComponent />
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />
			<CreateOrganizationDialog
				open={showCreateOrgModal}
				setOpen={setShowCreateOrgModal}
			/>
		</Sidebar>
	);
}

// Inline adaptation of UserMenu for Sidebar context if needed, or we can import the existing one.
// The existing UserMenu returns a DropdownMenu directly. We want to style the trigger to look like a SidebarMenuButton.
// Let's create a wrapper or modify UserMenu. For now, I'll create a local wrapper that uses the same logic.

import { ChevronsUpDown, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

function UserMenuComponent() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();

	if (isPending) return <Skeleton className="h-12 w-full rounded-lg" />;
	if (!session) return null; // Should not happen in dashboard

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<SidebarMenuButton
					size="lg"
					className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
				>
					<Avatar className="h-8 w-8 rounded-lg group-data-[collapsible=icon]:size-6">
						<AvatarImage
							src={session.user.image || ""}
							alt={session.user.name}
						/>
						<AvatarFallback className="rounded-lg">
							{session.user.name.slice(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
						<span className="truncate font-semibold">{session.user.name}</span>
						<span className="truncate text-xs">{session.user.email}</span>
					</div>
					<ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
				</SidebarMenuButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
				side="bottom"
				align="end"
				sideOffset={4}
			>
				<DropdownMenuLabel className="p-0 font-normal">
					<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
						<Avatar className="h-8 w-8 rounded-lg">
							<AvatarImage
								src={session.user.image || ""}
								alt={session.user.name}
							/>
							<AvatarFallback className="rounded-lg">
								{session.user.name.slice(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-semibold">
								{session.user.name}
							</span>
							<span className="truncate text-xs">{session.user.email}</span>
						</div>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href={"/account" as any}>
						<User className="mr-2 h-4 w-4" />
						Account
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={() => {
						authClient.signOut({
							fetchOptions: {
								onSuccess: () => {
									router.push("/");
								},
							},
						});
					}}
				>
					<LogOut className="mr-2 h-4 w-4" />
					Log out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

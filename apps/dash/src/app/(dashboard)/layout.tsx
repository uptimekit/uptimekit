import { AppSidebar } from "@/components/layout/app-sidebar";
import { DashboardBreadcrumbs } from "@/components/layout/dashboard-breadcrumbs";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 border-b bg-sidebar px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
					<div className="flex items-center gap-2">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="mr-2 h-4" />
						<DashboardBreadcrumbs />
					</div>
				</header>
				<main className="flex flex-1 flex-col gap-4 p-6 pt-10">{children}</main>
			</SidebarInset>
		</SidebarProvider>
	);
}

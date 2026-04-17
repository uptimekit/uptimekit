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
			<SidebarInset className="overflow-visible">
				<main className="flex flex-1 flex-col gap-6 rounded-lg border px-4">
					<header className="sticky top-0 z-50 -mx-4 flex h-16 w-[calc(100vw-16.65rem)] shrink-0 items-center gap-2 overflow-hidden border-b bg-popover/80 backdrop-blur-lg transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
						<div className="flex items-center gap-2 px-4">
							<SidebarTrigger className="-ml-1" />
							<Separator orientation="vertical" className="mr-2 h-4" />
							<DashboardBreadcrumbs />
						</div>
					</header>
					{children}
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}

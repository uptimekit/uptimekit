import { auth } from "@uptimekit/auth";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { DashboardBreadcrumbs } from "@/components/layout/dashboard-breadcrumbs";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

// Disable prerendering - this layout needs auth at runtime
export const dynamic = "force-dynamic";

export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || session.user.role !== "admin") {
		notFound();
	}

	return (
		<SidebarProvider>
			<AdminSidebar />
			<SidebarInset>
				<main className="flex flex-1 flex-col gap-6 overflow-hidden rounded-lg border px-4">
					<header className="-mx-4 flex h-16 shrink-0 items-center gap-2 border-b bg-accent/10 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
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

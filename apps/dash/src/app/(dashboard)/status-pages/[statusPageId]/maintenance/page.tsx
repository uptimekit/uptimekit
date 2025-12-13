"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CreateMaintenanceForm } from "@/components/status-pages/create-maintenance-form";
import { orpc } from "@/utils/orpc";
import { Badge } from "@/components/ui/badge";

export default function MaintenancePage() {
	const params = useParams();
	const statusPageId = params.statusPageId as string;
	const [createOpen, setCreateOpen] = useState(false);

	const { data: maintenanceRecords, isLoading } = useQuery(
		orpc.maintenance.list.queryOptions({
			input: { statusPageId },
		}),
	);

	const getStatusColor = (status: string) => {
		switch (status) {
			case "in_progress":
				return "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20";
			case "completed":
				return "bg-green-500/10 text-green-500 hover:bg-green-500/20";
			default:
				return "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20";
		}
	};

	return (
		<div className="space-y-6">
			<CreateMaintenanceForm
				statusPageId={statusPageId}
				open={createOpen}
				onOpenChange={setCreateOpen}
			/>

			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-medium">Maintenance</h2>
					<p className="text-muted-foreground text-sm">
						Schedule maintenance windows to keep your users informed.
					</p>
				</div>
				<Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
					<Plus className="h-4 w-4" /> Schedule maintenance
				</Button>
			</div>

			{isLoading ? (
				<div className="py-8 text-center text-muted-foreground">Loading...</div>
			) : maintenanceRecords?.length === 0 ? (
				<Card className="border-dashed bg-muted/10 shadow-none">
					<CardContent className="flex flex-col items-center justify-center py-16 text-center">
						<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
							<Plus className="h-6 w-6 text-muted-foreground" />
						</div>
						<h3 className="text-lg font-medium">No maintenance scheduled</h3>
						<p className="mt-1 max-w-sm text-sm text-muted-foreground">
							You can schedule maintenance ahead of time to let your users know
							about upcoming downtime.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{maintenanceRecords?.map(
						(maintenance: {
							id: string;
							title: string;
							startAt: Date;
							endAt: Date;
							status: string;
							description: string | null;
						}) => (
							<Link
								key={maintenance.id}
								href={
									`/status-pages/${statusPageId}/maintenance/${maintenance.id}` as any
								}
								className="block transition-all hover:opacity-80"
							>
								<Card>
									<CardHeader>
										<div className="flex items-center justify-between">
											<div className="space-y-1">
												<CardTitle className="text-base">
													{maintenance.title}
												</CardTitle>
												<div className="flex items-center gap-2 text-sm text-muted-foreground">
													<div className="flex items-center gap-1">
														<Calendar className="h-3 w-3" />
														<span>
															{new Date(
																maintenance.startAt,
															).toLocaleDateString()}
														</span>
													</div>
													<span>•</span>
													<div className="flex items-center gap-1">
														<Clock className="h-3 w-3" />
														<span>
															{new Date(
																maintenance.startAt,
															).toLocaleTimeString()}{" "}
															-{" "}
															{new Date(maintenance.endAt).toLocaleTimeString()}
														</span>
													</div>
												</div>
											</div>
											<Badge
												variant="secondary"
												className={getStatusColor(maintenance.status)}
											>
												{maintenance.status.replace("_", " ")}
											</Badge>
										</div>
									</CardHeader>
									{maintenance.description && (
										<CardContent>
											<p className="text-sm text-muted-foreground">
												{maintenance.description}
											</p>
										</CardContent>
									)}
								</Card>
							</Link>
						),
					)}
				</div>
			)}
		</div>
	);
}

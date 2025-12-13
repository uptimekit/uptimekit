"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Plus, CheckCircle, AlertTriangle, AlertOctagon } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CreateStatusUpdateForm } from "@/components/status-pages/create-update-form";
import { orpc } from "@/utils/orpc";
import { Badge } from "@/components/ui/badge";

export default function StatusUpdatesPage() {
	const params = useParams();
	const statusPageId = params.statusPageId as string;
	const [createOpen, setCreateOpen] = useState(false);

	const { data: updates, isLoading } = useQuery(
		orpc.statusUpdates.list.queryOptions({
			input: { statusPageId },
		}),
	);

	const getSeverityIcon = (severity: string) => {
		switch (severity) {
			case "critical":
				return <AlertOctagon className="h-4 w-4 text-red-500" />;
			case "major":
				return <AlertTriangle className="h-4 w-4 text-orange-500" />;
			case "minor":
				return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
			default:
				return <CheckCircle className="h-4 w-4 text-green-500" />;
		}
	};

	return (
		<div className="space-y-6">
			<CreateStatusUpdateForm
				statusPageId={statusPageId}
				open={createOpen}
				onOpenChange={setCreateOpen}
			/>

			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-medium">Status Updates</h2>
					<p className="text-muted-foreground text-sm">
						Post updates about incidents and service status.
					</p>
				</div>
				<Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
					<Plus className="h-4 w-4" /> Post update
				</Button>
			</div>

			{isLoading ? (
				<div className="py-8 text-center text-muted-foreground">Loading...</div>
			) : updates?.length === 0 ? (
				<Card className="border-dashed bg-muted/10 shadow-none">
					<CardContent className="flex flex-col items-center justify-center py-16 text-center">
						<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
							<Plus className="h-6 w-6 text-muted-foreground" />
						</div>
						<h3 className="text-lg font-medium">No updates found</h3>
						<p className="mt-1 max-w-sm text-sm text-muted-foreground">
							Keep your users in the loop by posting status updates when
							something goes wrong (or right).
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{updates?.map((report) => (
						<Card key={report.id}>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<div className="flex items-center gap-2">
									{getSeverityIcon(report.severity)}
									<CardTitle className="text-base">{report.title}</CardTitle>
									<Badge variant="outline" className="capitalize">
										{report.status}
									</Badge>
								</div>
								<div className="text-muted-foreground text-sm">
									{new Date(report.createdAt).toLocaleDateString()}
								</div>
							</CardHeader>
							<CardContent>
								<div className="space-y-4 pt-2">
									{report.updates.map((update) => (
										<div key={update.id} className="relative border-l-2 pl-4">
											<div className="mb-1 flex items-center gap-2">
												<Badge
													variant="secondary"
													className="text-xs uppercase"
												>
													{update.status}
												</Badge>
												<span className="text-muted-foreground text-xs">
													{new Date(update.createdAt).toLocaleString()}
												</span>
											</div>
											<p className="text-sm">{update.message}</p>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}

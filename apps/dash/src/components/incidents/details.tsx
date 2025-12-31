"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistance, formatDistanceToNow } from "date-fns";
import {
	ArrowLeft,
	CheckCircle2,
	Clock,
	CornerDownRight,
	MoreHorizontal,
	ShieldAlert,
	Trash2,
	User,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

export function IncidentDetails({ id }: { id: string }) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [comment, setComment] = useState("");

	const submitComment = useMutation(
		orpc.incidents.addComment.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.incidents.get.key({ input: { id } }),
				});
				setComment("");
				toast.success("Comment added");
			},
			onError: (err) => {
				toast.error("Failed to add comment: " + err.message);
			},
		}),
	);

	const { data: incident, isLoading } = useQuery(
		orpc.incidents.get.queryOptions({ input: { id } }),
	);

	const acknowledge = useMutation(
		orpc.incidents.acknowledge.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.incidents.get.key({ input: { id } }),
				});
				toast.success("Incident acknowledged");
			},
			onError: (err) => {
				toast.error("Failed to acknowledge incident: " + err.message);
			},
		}),
	);

	const resolve = useMutation(
		orpc.incidents.resolve.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.incidents.get.key({ input: { id } }),
				});
				toast.success("Incident resolved");
			},
			onError: (err) => {
				toast.error("Failed to resolve incident: " + err.message);
			},
		}),
	);

	if (isLoading) return <IncidentSkeleton />;

	if (!incident) {
		return (
			<div className="flex flex-col items-center justify-center py-10">
				<h2 className="font-bold text-xl">Incident not found</h2>
				<Button asChild className="mt-4">
					<Link href="/incidents">Go back to incidents</Link>
				</Button>
			</div>
		);
	}

	const isResolved = incident.status === "resolved";
	const isAcknowledged = !!incident.acknowledgedAt;

	return (
		<div className="mx-auto max-w-5xl space-y-6 p-6">
			{/* Header */}
			<div className="flex flex-col gap-6">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-4">
						<div
							className={cn(
								"flex h-12 w-12 items-center justify-center rounded-xl border",
								isResolved
									? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
									: "border-red-500/20 bg-red-500/10 text-red-500",
							)}
						>
							{isResolved ? (
								<CheckCircle2 className="h-6 w-6" />
							) : (
								<ShieldAlert className="h-6 w-6" />
							)}
						</div>
						<div>
							<h1 className="font-bold text-2xl tracking-tight">
								{incident.title}
							</h1>
							<div className="flex items-center gap-2 text-muted-foreground text-sm">
								<span
									className={cn(
										"font-medium",
										isResolved ? "text-emerald-500" : "text-red-500",
									)}
								>
									{isResolved ? "Resolved" : "Ongoing"}
								</span>
								<span>·</span>
								<span>
									{format(
										new Date(incident.createdAt),
										"MMM d, yyyy 'at' h:mm a",
									)}
								</span>
							</div>
						</div>
					</div>

					<div className="flex items-center gap-2">
						{!isResolved && !isAcknowledged && (
							<Button
								variant="outline"
								onClick={() => acknowledge.mutate({ id })}
								disabled={acknowledge.isPending}
							>
								Acknowledge
							</Button>
						)}
						{!isResolved && incident.type !== "automatic" && (
							<Button
								variant="outline"
								onClick={() => resolve.mutate({ id })}
								disabled={resolve.isPending}
							>
								Resolve
							</Button>
						)}
						{/* <Button variant="ghost" size="icon">
							<MoreHorizontal className="h-4 w-4" />
						</Button> */}
					</div>
				</div>
			</div>

			<div className="grid gap-6 md:grid-cols-3">
				<div className="min-w-[600px] space-y-6 md:col-span-2">
					{/* Description */}
					<Card>
						<CardHeader>
							<CardTitle>Description</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="prose prose-sm prose-invert max-w-none text-muted-foreground">
								{incident.description || "No description provided."}
							</div>
							{incident.monitors.length > 0 && (
								<div className="mt-4">
									<h4 className="mb-2 font-medium text-sm">
										Affected Monitors
									</h4>
									<div className="flex flex-wrap gap-2">
										{incident.monitors.map((m) => (
											<Badge
												key={m.monitor.id}
												variant="outline"
												className="gap-1"
											>
												{m.monitor.name}
											</Badge>
										))}
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Timeline */}
					<Card>
						<CardHeader>
							<CardTitle>Timeline</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="flex gap-2">
								<Input
									placeholder="Add a comment..."
									value={comment}
									onChange={(e) => setComment(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault();
											submitComment.mutate({
												incidentId: id,
												message: comment,
											});
										}
									}}
								/>
								<Button
									size="icon"
									variant="outline"
									onClick={() =>
										submitComment.mutate({ incidentId: id, message: comment })
									}
									disabled={!comment.trim() || submitComment.isPending}
								>
									<CornerDownRight className="h-4 w-4" />
								</Button>
							</div>
							<Separator />
							{incident.activities.map((activity, i) => (
								<div key={activity.id} className="relative flex gap-4 pl-2">
									{i !== incident.activities.length - 1 && (
										<div className="absolute top-8 bottom-[-24px] left-[11px] w-px bg-border" />
									)}
									<div className="relative z-10 mt-1 h-2.5 w-2.5 rounded-full bg-muted-foreground ring-4 ring-background" />
									<div className="flex-1 space-y-1">
										<div className="flex items-center gap-1.5 text-sm leading-none">
											{activity.user && (
												<Avatar className="h-4 w-4">
													<AvatarImage src={activity.user.image ?? undefined} alt={activity.user.name} />
													<AvatarFallback className="text-[8px]">
														{activity.user.name?.slice(0, 2).toUpperCase() ?? "??"}
													</AvatarFallback>
												</Avatar>
											)}
											<span>{activity.message}</span>
										</div>
										<p className="text-muted-foreground text-xs">
											{formatDistanceToNow(new Date(activity.createdAt), {
												addSuffix: true,
											})}
										</p>
									</div>
								</div>
							))}
						</CardContent>
					</Card>
				</div>

				<div className="space-y-6">
					{/* Metadata */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Details</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid gap-1">
								<span className="font-medium text-sm">Started at</span>
								<span className="text-muted-foreground text-sm">
									{formatDistanceToNow(new Date(incident.createdAt), {
										addSuffix: true,
									})}
								</span>
							</div>
							<Separator />
							{isAcknowledged && (
								<div className="grid gap-1">
									<span className="font-medium text-sm">Acknowledged by</span>
									<div className="flex items-center gap-2">
										<Badge
											variant="secondary"
											className="w-fit bg-zinc-800 text-zinc-400"
										>
											{incident.acknowledgedByUser?.name || "User"}
										</Badge>
										<span className="text-muted-foreground text-xs">
											{incident.acknowledgedAt &&
												formatDistanceToNow(new Date(incident.acknowledgedAt), {
													addSuffix: true,
												})}
										</span>
									</div>
									<Separator className="mt-4" />
								</div>
							)}
							<div className="grid gap-1">
								<span className="font-medium text-sm">Duration</span>
								<span className="text-muted-foreground text-sm">
									{isResolved && incident.resolvedAt
										? formatDistance(
												new Date(incident.createdAt),
												new Date(incident.resolvedAt),
											)
										: "Ongoing"}
									{/* Simple calculation for display if needed properly */}
								</span>
							</div>
							<Separator />
							<div className="grid gap-1">
								<span className="font-medium text-sm">Severity</span>
								<Badge variant="outline" className="w-fit">
									{incident.severity}
								</Badge>
							</div>
							<Separator />
							<div className="grid gap-1">
								<span className="font-medium text-sm">Type</span>
								<span className="text-muted-foreground text-sm capitalize">
									{incident.type}
								</span>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

function IncidentSkeleton() {
	return (
		<div className="mx-auto max-w-5xl p-6">
			<Skeleton className="mb-6 h-20 w-full" />
			<div className="grid gap-6 md:grid-cols-3">
				<div className="md:col-span-2">
					<Skeleton className="mb-6 h-40" />
					<Skeleton className="h-60" />
				</div>
				<div>
					<Skeleton className="h-60" />
				</div>
			</div>
		</div>
	);
}

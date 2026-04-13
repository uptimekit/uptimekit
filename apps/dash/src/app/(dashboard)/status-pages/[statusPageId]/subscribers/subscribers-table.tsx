"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	ChevronDown,
	Loader2,
	Mail,
	MessageSquare,
	Search,
	Users,
	Webhook,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { DataPagination } from "@/components/ui/data-pagination";
import { orpc } from "@/utils/orpc";

type Subscriber = {
	email: string;
	slackWebhookUrl?: string | null;
	discordWebhookUrl?: string | null;
	statusPageId: string;
	createdAt: Date | string | null;
};

type SubscribersResponse = {
	items: Subscriber[];
	total: number;
};

export function SubscribersTable({ statusPageId }: { statusPageId: string }) {
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [page, setPage] = useState(1);
	const pageSize = 10;

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(search);
			setPage(1);
		}, 300);

		return () => clearTimeout(timer);
	}, [search]);

	const { data, isLoading } = useQuery(
		orpc.statusPages.subscribers.get.queryOptions({
			input: {
				statusPageId,
				q: debouncedSearch || undefined,
				limit: pageSize,
				offset: (page - 1) * pageSize,
			},
		}),
	);

	const subscribers = ((data as SubscribersResponse | undefined)?.items ??
		[]) as Subscriber[];
	const total = (data as SubscribersResponse | undefined)?.total ?? 0;
	const totalPages = Math.ceil(total / pageSize);

	return (
		<div className="w-full mx-auto max-w-6xl space-y-4">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Subscribers</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Email subscribers for this status page.
					</p>
				</div>
				<div className="relative w-full max-w-xs">
					<Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search subscribers..."
						className="pl-8"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
				<div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3 font-medium text-muted-foreground text-sm">
					<ChevronDown className="h-4 w-4" />
					Subscribers ({total})
				</div>

				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead className="pl-6">Subscriber</TableHead>
							<TableHead>Channels</TableHead>
							<TableHead>Subscribed</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell colSpan={3} className="py-8 text-center">
									<Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
								</TableCell>
							</TableRow>
						) : subscribers.length === 0 ? (
							<TableRow>
								<TableCell colSpan={3} className="h-24 text-center">
									<div className="flex flex-col items-center justify-center gap-2 py-6">
										<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
											{search ? (
												<Search className="h-6 w-6 text-muted-foreground" />
											) : (
												<Users className="h-6 w-6 text-muted-foreground" />
											)}
										</div>
										<p className="font-medium text-lg">No subscribers found</p>
										<p className="text-muted-foreground text-sm">
											{search
												? "Try adjusting your search."
												: "This status page has no email subscribers yet."}
										</p>
										</div>
									</TableCell>
								</TableRow>
						) : (
							subscribers.map((subscriber) => (
								<TableRow
									key={`${subscriber.statusPageId}-${subscriber.email}`}
								>
									<TableCell className="pl-6">
										<div className="flex items-center gap-3">
											<div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
												<Mail className="h-4 w-4 text-muted-foreground" />
											</div>
											<div className="grid gap-1">
												<span className="font-semibold leading-none">
													{subscriber.email}
												</span>
												<span className="text-muted-foreground text-xs">
													Email subscriber
												</span>
											</div>
										</div>
									</TableCell>
									<TableCell className="text-muted-foreground">
										<div className="flex flex-wrap items-center gap-2">
											<span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
												<Mail className="h-3 w-3" />
												Email
											</span>
											{subscriber.slackWebhookUrl ? (
												<span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
													<MessageSquare className="h-3 w-3" />
													Slack
												</span>
											) : null}
											{subscriber.discordWebhookUrl ? (
												<span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
													<Webhook className="h-3 w-3" />
													Discord
												</span>
											) : null}
										</div>
									</TableCell>
									<TableCell className="text-muted-foreground">
										{subscriber.createdAt
											? format(new Date(subscriber.createdAt), "MMM d, yyyy")
											: "Unknown"}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>

				<DataPagination page={page} totalPages={totalPages} setPage={setPage} />
			</div>
		</div>
	);
}

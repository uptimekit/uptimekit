"use client";

import { useQueries, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import React from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { orpc } from "@/utils/orpc";

function isUUID(str: string): boolean {
	return /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(
		str,
	);
}

function formatSegment(segment: string): string {
	return segment
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

/**
 * Render breadcrumb navigation for the current pathname, resolving UUID segments to human-friendly titles.
 *
 * Uses the current pathname to build a breadcrumb trail. For segments that are UUIDs, attempts to resolve a
 * display title from the query cache based on the preceding segment (e.g., "status-pages", "monitors", "incidents").
 * Falls back to a formatted segment label for non-UUIDs or a shortened UUID (first 8 chars + ellipsis) when no cached
 * data is available. Special-case labels: "status-updates" -> "Update" and "maintenance" -> "Maintenance".
 *
 * @returns A breadcrumb React element representing the current path, using cached resource names for UUID segments when available.
 */
export function DashboardBreadcrumbs() {
	const pathname = usePathname();
	const queryClient = useQueryClient();
	const segments = pathname.split("/").filter((segment) => segment !== "");

	const uuidSegments = segments
		.map((segment, index) => ({
			segment,
			index,
			previousSegment: segments[index - 1],
		}))
		.filter(({ segment }) => isUUID(segment));

	useQueries({
		queries: uuidSegments.map(({ segment, previousSegment }) => {
			if (previousSegment === "status-pages") {
				return {
					...orpc.statusPages.get.queryOptions({ input: { id: segment } }),
					staleTime: Number.POSITIVE_INFINITY,
				};
			}
			if (previousSegment === "monitors") {
				return {
					...orpc.monitors.get.queryOptions({ input: { id: segment } }),
					staleTime: Number.POSITIVE_INFINITY,
				};
			}
			if (previousSegment === "incidents") {
				return {
					...orpc.incidents.get.queryOptions({ input: { id: segment } }),
					staleTime: Number.POSITIVE_INFINITY,
				};
			}
			return {
				queryKey: ["noop", segment],
				queryFn: () => null,
				enabled: false,
			};
		}),
	});

	const getResolvedTitle = (segment: string, index: number): string => {
		if (!isUUID(segment)) {
			return formatSegment(segment);
		}

		const previousSegment = segments[index - 1];

		if (previousSegment === "status-pages") {
			const queryKey = orpc.statusPages.get.queryOptions({
				input: { id: segment },
			}).queryKey;
			const data = queryClient.getQueryData(queryKey) as
				| { name?: string }
				| undefined;
			if (data?.name) return data.name;
		}

		if (previousSegment === "monitors") {
			const queryKey = orpc.monitors.get.queryOptions({
				input: { id: segment },
			}).queryKey;
			const data = queryClient.getQueryData(queryKey) as
				| { name?: string }
				| undefined;
			if (data?.name) return data.name;
		}

		if (previousSegment === "incidents") {
			const queryKey = orpc.incidents.get.queryOptions({
				input: { id: segment },
			}).queryKey;
			const data = queryClient.getQueryData(queryKey) as
				| { title?: string }
				| undefined;
			if (data?.title) return data.title;
		}

		if (previousSegment === "status-updates") return "Update";
		if (previousSegment === "maintenance") return "Maintenance";

		return `${segment.slice(0, 8)}...`;
	};

	return (
		<Breadcrumb>
			<BreadcrumbList>
				{segments.length === 0 ? (
					<BreadcrumbItem>
						<BreadcrumbPage>Incidents</BreadcrumbPage>
					</BreadcrumbItem>
				) : (
					segments.map((segment, index) => {
						const href = `/${segments.slice(0, index + 1).join("/")}`;
						const isLast = index === segments.length - 1;
						const title = getResolvedTitle(segment, index);

						return (
							<React.Fragment key={href}>
								{index > 0 && (
									<BreadcrumbSeparator className="hidden md:block" />
								)}
								<BreadcrumbItem>
									{isLast ? (
										<BreadcrumbPage>{title}</BreadcrumbPage>
									) : (
										<BreadcrumbLink href={href}>{title}</BreadcrumbLink>
									)}
								</BreadcrumbItem>
							</React.Fragment>
						);
					})
				)}
			</BreadcrumbList>
		</Breadcrumb>
	);
}

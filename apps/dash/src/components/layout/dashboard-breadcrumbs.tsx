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
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
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

type ResolvedTitle =
    | {
          isLoading: true;
          title?: never;
      }
    | {
          isLoading?: false;
          title: string;
      };

function BreadcrumbTitleSkeleton({
    isCurrent,
}: {
    isCurrent: boolean;
}): React.ReactElement {
    return (
        <div
            aria-current={isCurrent ? "page" : undefined}
            aria-live="polite"
            className="inline-flex h-5 w-24 items-center"
        >
            <Skeleton aria-hidden="true" className="h-4 w-20" />
            <span className="sr-only">Loading breadcrumb</span>
        </div>
    );
}

/**
 * Render breadcrumb navigation for the current pathname, resolving UUID segments to human-friendly titles.
 *
 * Uses the current pathname to build a breadcrumb trail. For segments that are UUIDs, attempts to resolve a
 * display title from the query cache based on the preceding segment (e.g., "status-pages", "monitors", "incidents").
 * Renders a skeleton while resolvable UUIDs are loading, then falls back to a shortened UUID (first 8 chars + ellipsis)
 * only when no display title is available. Special-case labels: "status-updates" -> "Update" and "maintenance" -> "Maintenance".
 *
 * @returns A breadcrumb React element representing the current path, using cached resource names for UUID segments when available.
 */
export function DashboardBreadcrumbs() {
    const pathname = usePathname();
    const queryClient = useQueryClient();
    const { data: organizations, isPending: isLoadingOrganizations } =
        authClient.useListOrganizations();
    const segments = pathname.split("/").filter((segment) => segment !== "");

    const uuidSegments = segments
        .map((segment, index) => ({
            segment,
            index,
            previousSegment: segments[index - 1],
        }))
        .filter(({ segment }) => isUUID(segment));

    const uuidQueryResults = useQueries({
        queries: uuidSegments.map(({ segment, previousSegment }) => {
            if (previousSegment === "status-pages") {
                return {
                    ...orpc.statusPages.get.queryOptions({
                        input: { id: segment },
                    }),
                    staleTime: Number.POSITIVE_INFINITY,
                };
            }
            if (previousSegment === "monitors") {
                return {
                    ...orpc.monitors.get.queryOptions({
                        input: { id: segment },
                    }),
                    staleTime: Number.POSITIVE_INFINITY,
                };
            }
            if (previousSegment === "incidents") {
                return {
                    ...orpc.incidents.get.queryOptions({
                        input: { id: segment },
                    }),
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

    const getUuidQueryResult = (segment: string, index: number) => {
        const queryIndex = uuidSegments.findIndex(
            (item) => item.segment === segment && item.index === index,
        );

        return queryIndex >= 0 ? uuidQueryResults[queryIndex] : undefined;
    };

    const getResolvedTitle = (
        segment: string,
        index: number,
    ): ResolvedTitle => {
        const previousSegment = segments[index - 1];

        if (segment === "organization") return { title: "Organization" };

        if (previousSegment === "organization") {
            const organization = organizations?.find(
                (org) => org.id === segment,
            );
            if (!organization && isLoadingOrganizations) {
                return { isLoading: true };
            }

            return { title: organization?.name || `${segment.slice(0, 8)}...` };
        }

        if (!isUUID(segment)) {
            return { title: formatSegment(segment) };
        }

        if (previousSegment === "status-pages") {
            const queryKey = orpc.statusPages.get.queryOptions({
                input: { id: segment },
            }).queryKey;
            const data = queryClient.getQueryData(queryKey) as
                | { name?: string }
                | undefined;
            if (data?.name) return { title: data.name };

            const queryResult = getUuidQueryResult(segment, index);
            if (queryResult?.isPending || queryResult?.isFetching) {
                return { isLoading: true };
            }
        }

        if (previousSegment === "monitors") {
            const queryKey = orpc.monitors.get.queryOptions({
                input: { id: segment },
            }).queryKey;
            const data = queryClient.getQueryData(queryKey) as
                | { name?: string }
                | undefined;
            if (data?.name) return { title: data.name };

            const queryResult = getUuidQueryResult(segment, index);
            if (queryResult?.isPending || queryResult?.isFetching) {
                return { isLoading: true };
            }
        }

        if (previousSegment === "incidents") {
            const queryKey = orpc.incidents.get.queryOptions({
                input: { id: segment },
            }).queryKey;
            const data = queryClient.getQueryData(queryKey) as
                | { title?: string }
                | undefined;
            if (data?.title) return { title: data.title };

            const queryResult = getUuidQueryResult(segment, index);
            if (queryResult?.isPending || queryResult?.isFetching) {
                return { isLoading: true };
            }
        }

        if (previousSegment === "status-updates") return { title: "Update" };
        if (previousSegment === "maintenance") return { title: "Maintenance" };

        return { title: `${segment.slice(0, 8)}...` };
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
                        const isOrganizationSegment =
                            segment === "organization" ||
                            segments[index - 1] === "organization";
                        const resolvedTitle = getResolvedTitle(segment, index);

                        return (
                            <React.Fragment key={href}>
                                {index > 0 && (
                                    <BreadcrumbSeparator className="hidden md:block" />
                                )}
                                <BreadcrumbItem>
                                    {resolvedTitle.isLoading ? (
                                        <BreadcrumbTitleSkeleton
                                            isCurrent={
                                                isLast || isOrganizationSegment
                                            }
                                        />
                                    ) : isLast || isOrganizationSegment ? (
                                        <BreadcrumbPage>
                                            {resolvedTitle.title}
                                        </BreadcrumbPage>
                                    ) : (
                                        <BreadcrumbLink href={href}>
                                            {resolvedTitle.title}
                                        </BreadcrumbLink>
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

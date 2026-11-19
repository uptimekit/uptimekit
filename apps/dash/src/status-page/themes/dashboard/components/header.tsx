"use client";

import Image from "next/image";
import Link from "next/link";
import type React from "react";
import { SubscribeForm } from "@/status-page/components/subscribe-form";
import { buildPath } from "@/status-page/lib/route-utils";
import { cn } from "@/status-page/lib/utils";

interface HeaderProps {
    title?: string;
    logoUrl?: string;
    contactUrl?: string;
    websiteUrl?: string;
    statusPageId?: string;
    slug?: string;
    allowSubscriptions?: boolean;
    layout?: "vertical" | "horizontal";
    className?: string;
}

export function Header({
    title = "System Status",
    logoUrl,
    contactUrl,
    websiteUrl,
    statusPageId,
    slug,
    allowSubscriptions = true,
    layout = "horizontal",
    className,
}: HeaderProps): React.JSX.Element {
    const isMailto = contactUrl?.startsWith("mailto:");
    const isVertical = layout === "vertical";

    return (
        <header
            className={cn(
                "sticky top-0 z-40 w-full border-border/60 border-b bg-background/80 backdrop-blur-md",
                className,
            )}
        >
            <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
                <div
                    className={cn(
                        "flex items-center justify-between gap-4",
                        isVertical
                            ? "flex-col items-start sm:flex-row sm:items-center"
                            : "",
                    )}
                >
                    <div className="flex min-w-0 items-center gap-3">
                        {logoUrl ? (
                            <Link
                                href={buildPath("/", slug) as any}
                                className="flex items-center"
                            >
                                <Image
                                    src={logoUrl}
                                    alt={title}
                                    width={160}
                                    height={32}
                                    unoptimized
                                    className="h-7 w-auto"
                                />
                            </Link>
                        ) : (
                            <Link
                                href={buildPath("/", slug) as any}
                                className="flex items-center gap-2"
                            >
                                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground font-bold text-background text-xs">
                                    UK
                                </span>
                                <h1 className="truncate font-semibold text-base text-foreground tracking-tight">
                                    {title}
                                </h1>
                            </Link>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                        <nav className="flex items-center gap-1">
                            <Link
                                href={buildPath("/", slug) as any}
                                className="rounded-md px-2.5 py-1.5 font-medium text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-foreground"
                            >
                                Overview
                            </Link>
                            <Link
                                href={buildPath("/updates", slug) as any}
                                className="rounded-md px-2.5 py-1.5 font-medium text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-foreground"
                            >
                                Incidents
                            </Link>
                            {websiteUrl ? (
                                <a
                                    href={websiteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-md px-2.5 py-1.5 font-medium text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-foreground"
                                >
                                    Website
                                </a>
                            ) : null}
                        </nav>

                        <div className="h-4 w-px bg-border" />

                        {contactUrl && (
                            <a
                                href={contactUrl}
                                target={isMailto ? undefined : "_blank"}
                                rel="noopener noreferrer"
                                className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-card px-3 font-medium text-foreground text-xs shadow-2xs transition-colors hover:bg-accent hover:text-accent-foreground"
                            >
                                Support
                            </a>
                        )}
                        {statusPageId ? (
                            <SubscribeForm
                                statusPageId={statusPageId}
                                slug={slug}
                                allowEmailSubscriptions={allowSubscriptions}
                            />
                        ) : null}
                    </div>
                </div>
            </div>
        </header>
    );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { SubscribeForm } from "@/status-page/components/subscribe-form";
import { buildPath } from "@/status-page/lib/route-utils";

interface HeaderProps {
    title?: string;
    logoUrl?: string;
    contactUrl?: string;
    websiteUrl?: string;
    statusPageId?: string;
    slug?: string;
    allowSubscriptions?: boolean;
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
    className,
}: HeaderProps) {
    const isMailto = contactUrl?.startsWith("mailto:");

    return (
        <header className={className}>
            <div className="relative mx-auto max-w-4xl border-border/40 border-b px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-6">
                    <div className="min-w-0 flex-1">
                        {logoUrl ? (
                            <Image
                                src={logoUrl}
                                alt={title}
                                width={160}
                                height={32}
                                unoptimized
                                className="h-8 w-auto"
                            />
                        ) : (
                            <h1 className="truncate font-bold text-foreground text-xl">
                                {title}
                            </h1>
                        )}
                    </div>

                    <nav className="hidden items-center gap-0.5 md:flex">
                        <Link
                            href={buildPath("/", slug) as any}
                            className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground text-sm transition-colors hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-700!"
                        >
                            Status
                        </Link>
                        <Link
                            href={buildPath("/updates", slug) as any}
                            className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground text-sm transition-colors hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-700!"
                        >
                            Updates
                        </Link>
                        {websiteUrl ? (
                            <a
                                href={websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground text-sm transition-colors hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-700!"
                            >
                                Website
                            </a>
                        ) : null}
                    </nav>

                    <div className="ml-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                        {contactUrl && (
                            <a
                                href={contactUrl}
                                target={isMailto ? undefined : "_blank"}
                                rel="noopener noreferrer"
                                className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-white px-4 font-medium text-foreground text-sm transition-colors hover:bg-neutral-100 dark:bg-muted dark:hover:bg-neutral-700!"
                            >
                                Get in touch
                            </a>
                        )}
                        {statusPageId ? (
                            <SubscribeForm
                                statusPageId={statusPageId}
                                slug={slug}
                                variant="flat"
                                allowEmailSubscriptions={allowSubscriptions}
                            />
                        ) : null}
                    </div>
                </div>
            </div>
        </header>
    );
}

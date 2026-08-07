"use client";

import {
    faCalendarDays,
    faGlobe,
    faHouse,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
}

export function Header({
    title = "System Status",
    logoUrl,
    contactUrl,
    websiteUrl,
    statusPageId,
    slug,
    allowSubscriptions = true,
}: HeaderProps) {
    const homeHref = buildPath("/", slug);
    const isMailto = contactUrl?.startsWith("mailto:");

    return (
        <header className="sticky top-0 z-30 bg-background">
            <div className="mx-auto flex w-full max-w-[822px] flex-col gap-5 px-4 pt-6">
                <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 py-px min-[768px]:grid-cols-[1fr_auto_1fr]">
                    <div className="min-w-0">
                        {websiteUrl ? (
                            <a
                                href={websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex min-w-0 items-center gap-2 justify-self-start no-underline"
                            >
                                <Brand title={title} logoUrl={logoUrl} />
                            </a>
                        ) : (
                            <Link
                                href={homeHref as any}
                                className="flex min-w-0 items-center gap-2 justify-self-start no-underline"
                            >
                                <Brand title={title} logoUrl={logoUrl} />
                            </Link>
                        )}
                    </div>

                    <div className="flex items-center gap-3 justify-self-end min-[768px]:order-last">
                        {statusPageId ? (
                            <SubscribeForm
                                statusPageId={statusPageId}
                                slug={slug}
                                variant="signal"
                                allowEmailSubscriptions={allowSubscriptions}
                            />
                        ) : null}
                        {contactUrl && (
                            <a
                                href={contactUrl}
                                target={isMailto ? undefined : "_blank"}
                                rel="noopener noreferrer"
                                className="signal-button inline-flex items-center justify-center rounded-lg px-3 py-1.5 font-medium text-[14px] text-foreground leading-5"
                            >
                                Contact
                            </a>
                        )}
                    </div>

                    <nav className="col-span-2 flex items-center justify-center gap-2 min-[768px]:col-span-1 min-[768px]:justify-self-center">
                        <Link
                            href={homeHref as any}
                            className="inline-flex items-center justify-center gap-1 overflow-hidden rounded-lg bg-accent px-3 py-1.5 font-medium text-[14px] text-foreground leading-5"
                        >
                            <FontAwesomeIcon
                                icon={faHouse}
                                className="h-3 w-3"
                            />
                            <span className="hidden min-[384px]:inline">
                                Overview
                            </span>
                        </Link>
                        {websiteUrl ? (
                            <a
                                href={websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="signal-button inline-flex items-center justify-center gap-1 overflow-hidden rounded-lg px-3 py-1.5 font-medium text-[14px] text-foreground leading-5"
                            >
                                <FontAwesomeIcon
                                    icon={faGlobe}
                                    className="h-3 w-3"
                                />
                                <span className="hidden min-[384px]:inline">
                                    Website
                                </span>
                            </a>
                        ) : null}
                        <Link
                            href={buildPath("/updates", slug) as any}
                            className="signal-button inline-flex items-center justify-center gap-1 overflow-hidden rounded-lg px-3 py-1.5 font-medium text-[14px] text-foreground leading-5"
                        >
                            <FontAwesomeIcon
                                icon={faCalendarDays}
                                className="h-3 w-3"
                            />
                            <span className="hidden min-[384px]:inline">
                                History
                            </span>
                        </Link>
                    </nav>
                </div>
                <div className="signal-divider -mx-1.5 h-[1.5px] w-[calc(100%+12px)] rounded-full" />
            </div>
        </header>
    );
}

function Brand({ title, logoUrl }: { title: string; logoUrl?: string }) {
    return (
        <>
            {logoUrl ? (
                <Image
                    src={logoUrl}
                    alt={title}
                    width={120}
                    height={24}
                    unoptimized
                    className="h-6 w-auto rounded"
                />
            ) : (
                <div className="signal-mark flex h-[22px] w-[22px] items-center justify-center rounded-full font-bold text-[11px]">
                    {title.slice(0, 1).toUpperCase()}
                </div>
            )}
            <div className="min-w-0">
                <div className="truncate font-bold text-[18px] text-foreground leading-none">
                    {title}
                </div>
            </div>
        </>
    );
}

import Image from "next/image";
import Link from "next/link";
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
        <header className={cn("relative", className)}>
            <div className="relative mx-auto max-w-5xl px-4 py-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
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
                    <div className="ml-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                        <Link
                            href={buildPath("/updates", slug) as any}
                            className="inline-flex h-10 items-center justify-center rounded-lg px-3 font-medium text-muted-foreground text-sm hover:bg-accent hover:text-foreground"
                        >
                            History
                        </Link>
                        {websiteUrl ? (
                            <a
                                href={websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-10 items-center justify-center rounded-lg px-3 font-medium text-muted-foreground text-sm hover:bg-accent hover:text-foreground"
                            >
                                Website
                            </a>
                        ) : null}
                        {contactUrl && (
                            <a
                                href={contactUrl}
                                target={isMailto ? undefined : "_blank"}
                                rel="noopener noreferrer"
                                className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 font-medium text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 sm:px-6"
                            >
                                Get in touch
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

import Image from "next/image";
import Link from "next/link";
import { SubscribeForm } from "@/status-page/components/subscribe-form";
import { buildPath } from "@/status-page/lib/route-utils";
import type { StatusPageConfig } from "@/status-page/themes/types";

export function Header({ config }: { config: StatusPageConfig }) {
    const { design } = config;
    const isMailto = design.contactUrl?.startsWith("mailto:");

    return (
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0">
                {design.logoUrl ? (
                    <Image
                        src={design.logoUrl}
                        alt={config.name}
                        width={160}
                        height={32}
                        unoptimized
                        className="max-h-8 w-auto"
                    />
                ) : (
                    <div className="truncate font-bold text-2xl">
                        {config.name}
                    </div>
                )}
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:gap-3">
                <Link
                    href={buildPath("/updates", config.routeSlug) as any}
                    className="inline-flex h-9 items-center justify-center rounded-md px-3 font-semibold text-muted-foreground text-sm hover:bg-muted hover:text-foreground"
                >
                    History
                </Link>
                {design.websiteUrl ? (
                    <a
                        href={design.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center justify-center rounded-md px-3 font-semibold text-muted-foreground text-sm hover:bg-muted hover:text-foreground"
                    >
                        Website
                    </a>
                ) : null}
                {design.contactUrl ? (
                    <a
                        href={design.contactUrl}
                        target={isMailto ? undefined : "_blank"}
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 font-semibold text-sm transition-colors hover:bg-muted"
                    >
                        Report a problem
                    </a>
                ) : null}
                <SubscribeForm
                    statusPageId={config.id}
                    slug={config.routeSlug}
                    className="font-[550]"
                    variant="spark"
                    allowEmailSubscriptions={design.allowSubscriptions}
                />
            </div>
        </header>
    );
}

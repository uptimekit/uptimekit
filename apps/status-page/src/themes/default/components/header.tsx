import Image from "next/image";
import { SubscribeForm } from "@/components/subscribe-form";
import { cn } from "@/lib/utils";

interface HeaderProps {
    title?: string;
    logoUrl?: string;
    contactUrl?: string;
    statusPageId?: string;
    slug?: string;
    allowSubscriptions?: boolean;
    className?: string;
}

export function Header({
    title = "System Status",
    logoUrl,
    contactUrl,
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
                            <>
                                <Image
                                    src={logoUrl}
                                    alt={title}
                                    width={160}
                                    height={32}
                                    unoptimized
                                    className="h-8 w-auto"
                                />
                            </>
                        ) : (
                            <h1 className="truncate font-bold text-foreground text-xl">
                                {title}
                            </h1>
                        )}
                    </div>
                    <div className="ml-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
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

import { faChevronRight, faLock } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { StatusDot } from "@/status-page/components/status-indicator";
import { cn } from "@/status-page/lib/utils";
import { statusConfig } from "@/status-page/themes/status-config";
import type { LinkedStatusPage } from "@/status-page/themes/types";

function LinkedPageRow({ page }: { page: LinkedStatusPage }) {
    const config = page.status ? statusConfig[page.status] : null;

    return (
        <a
            href={page.url}
            className="group flex items-center gap-3 px-6 py-4 transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
        >
            {/* Fixed-width slot so the dot and the lock line the names up */}
            <span className="flex w-3 shrink-0 items-center justify-center">
                {page.status ? (
                    <StatusDot status={page.status} />
                ) : (
                    <FontAwesomeIcon
                        icon={faLock}
                        aria-label="Password protected"
                        className="h-3 w-3 text-muted-foreground"
                    />
                )}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold text-card-foreground">
                {page.name}
            </span>
            {config ? (
                <span
                    className={cn(
                        "hidden shrink-0 font-medium text-sm sm:inline",
                        config.color,
                    )}
                >
                    {config.label}
                </span>
            ) : null}
            <FontAwesomeIcon
                icon={faChevronRight}
                className="h-3 w-3 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            />
        </a>
    );
}

export function LinkedPagesSection({
    linkedPages,
    className,
}: {
    linkedPages?: LinkedStatusPage[];
    className?: string;
}) {
    if (!linkedPages?.length) {
        return null;
    }

    return (
        <section className={cn("mb-16", className)}>
            <h2 className="mb-6 font-bold text-2xl text-foreground">
                Other status pages
            </h2>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                {linkedPages.map((page) => (
                    <LinkedPageRow key={page.id} page={page} />
                ))}
            </div>
        </section>
    );
}

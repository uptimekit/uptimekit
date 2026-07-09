import { SubscribeForm } from "@/components/subscribe-form";
import type { ThemePageProps } from "@/themes/types";

export function Header({ data }: ThemePageProps) {
    const { config } = data;
    const { design } = config;
    const isMailto = design.contactUrl?.startsWith("mailto:");

    return (
        <header className="flex items-center justify-between gap-4">
            <div className="min-w-0">
                {design.logoUrl ? (
                    // biome-ignore lint/performance/noImgElement: theme headers render arbitrary remote logos
                    <img
                        src={design.logoUrl}
                        alt={config.name}
                        className="max-h-8 w-auto"
                    />
                ) : (
                    <div className="truncate font-bold text-2xl">
                        {config.name}
                    </div>
                )}
            </div>

            <div className="flex shrink-0 items-center gap-3">
                {design.contactUrl ? (
                    <a
                        href={design.contactUrl}
                        target={isMailto ? undefined : "_blank"}
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 font-medium text-sm transition-colors hover:bg-muted"
                    >
                        Report a problem
                    </a>
                ) : null}
                <SubscribeForm
                    statusPageId={config.id}
                    slug={config.routeSlug}
                    variant="spark"
                    allowEmailSubscriptions={design.allowSubscriptions}
                />
            </div>
        </header>
    );
}

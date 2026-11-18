import type React from "react";
import { cn } from "@/status-page/lib/utils";

interface FooterProps {
    companyName?: string;
    companyUrl?: string;
    className?: string;
}

export function Footer({
    companyName = "UptimeKit",
    companyUrl = "https://github.com/uptimekit/uptimekit",
    className,
}: FooterProps): React.JSX.Element {
    const currentYear = new Date().getFullYear();

    return (
        <footer
            className={cn(
                "w-full border-border/40 border-t bg-card/50 py-6 text-muted-foreground text-xs",
                className,
            )}
        >
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
                <div className="flex items-center gap-2">
                    <span>&copy; {currentYear}</span>
                    <a
                        href={companyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-foreground/80 transition-colors hover:text-foreground hover:underline"
                    >
                        {companyName}
                    </a>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-muted-foreground/80">
                        Theme by tfj
                    </span>
                    <span className="hidden text-border sm:inline">•</span>
                    <div className="flex items-center gap-1.5">
                        <span>Powered by</span>
                        <a
                            href="https://github.com/uptimekit/uptimekit"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-foreground/90 transition-colors hover:text-foreground"
                        >
                            <span className="flex h-4 w-4 items-center justify-center rounded-xs bg-foreground font-bold text-[9px] text-background">
                                UK
                            </span>
                            <span>UptimeKit</span>
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}

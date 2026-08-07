import { Logo } from "./uk-logo";

export function Footer() {
    return (
        <footer className="mx-auto w-full max-w-2xl px-4 pb-8 text-center text-muted-foreground text-sm">
            <div className="flex items-center justify-center gap-2">
                <span>Powered by</span>
                <a
                    className="flex items-center gap-1"
                    href="https://github.com/uptimekit/uptimekit"
                    target="_blank"
                    rel="noreferrer"
                >
                    <Logo className="size-6" />
                    <span className="font-semibold text-md text-muted-foreground">
                        UptimeKit
                    </span>
                </a>
            </div>
        </footer>
    );
}

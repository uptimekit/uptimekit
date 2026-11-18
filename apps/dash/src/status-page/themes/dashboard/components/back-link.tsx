import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import type React from "react";

interface BackLinkProps {
    href: string;
    label?: string;
}

export function BackLink({
    href,
    label = "Back to status",
}: BackLinkProps): React.JSX.Element {
    return (
        <Link
            href={href as any}
            className="mb-6 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 font-medium text-muted-foreground text-xs shadow-2xs transition-colors hover:bg-accent hover:text-foreground"
        >
            <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" />
            <span>{label}</span>
        </Link>
    );
}

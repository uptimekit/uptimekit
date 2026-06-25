import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type React from "react";
import { cn } from "@/lib/utils";

export function Spinner({
    className,
    ...props
}: Omit<
    React.ComponentProps<typeof FontAwesomeIcon>,
    "icon"
>): React.ReactElement {
    return (
        <FontAwesomeIcon
            icon={faSpinner}
            aria-label="Loading"
            className={cn("animate-spin", className)}
            role="status"
            {...props}
        />
    );
}
